/**
 * AWS Connector - Real AWS services integration
 * Handles multiple AWS services with unified interface
 */

const BaseConnector = require('../base-connector');
const AWS = require('aws-sdk');

class AWSConnector extends BaseConnector {
    constructor(config = {}) {
        super(config);
        
        this.services = new Map();
        this.region = config.credentials?.region || 'us-east-1';
        this.awsConfig = null;
    }

    /**
     * Initialize AWS connection
     */
    async initialize() {
        console.log('🔌 Initializing AWS connector...');
        
        try {
            const { credentials } = this.config;
            
            if (!credentials) {
                throw new Error('AWS credentials not provided');
            }

            // Configure AWS SDK
            this.awsConfig = {
                accessKeyId: credentials.accessKeyId,
                secretAccessKey: credentials.secretAccessKey,
                region: this.region
            };

            if (credentials.sessionToken) {
                this.awsConfig.sessionToken = credentials.sessionToken;
            }

            AWS.config.update(this.awsConfig);

            // Test connection with STS
            await this.testConnection();
            
            this.isConnected = true;
            console.log('✅ AWS connector initialized');
            
        } catch (error) {
            console.error('❌ Failed to initialize AWS connector:', error);
            throw error;
        }
    }

    /**
     * Test AWS connection
     */
    async testConnection() {
        try {
            const sts = this.getService('STS');
            const identity = await sts.getCallerIdentity().promise();
            
            return {
                success: true,
                message: `Connected to AWS account ${identity.Account}`,
                details: {
                    accountId: identity.Account,
                    userId: identity.UserId,
                    arn: identity.Arn
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error.stack
            };
        }
    }

    /**
     * Get or create AWS service instance
     */
    getService(serviceName, options = {}) {
        const key = `${serviceName}_${JSON.stringify(options)}`;
        
        if (!this.services.has(key)) {
            const ServiceClass = AWS[serviceName];
            if (!ServiceClass) {
                throw new Error(`Unknown AWS service: ${serviceName}`);
            }

            const service = new ServiceClass({
                ...this.awsConfig,
                ...options
            });

            this.services.set(key, service);
        }

        return this.services.get(key);
    }

    /**
     * S3 Operations
     */
    
    async s3ListBuckets() {
        const s3 = this.getService('S3');
        const result = await s3.listBuckets().promise();
        return result.Buckets;
    }

    async s3ListObjects(bucket, prefix = '', options = {}) {
        const s3 = this.getService('S3');
        const params = {
            Bucket: bucket,
            Prefix: prefix,
            MaxKeys: options.maxKeys || 1000,
            ...options
        };

        const result = await s3.listObjectsV2(params).promise();
        return {
            objects: result.Contents,
            isTruncated: result.IsTruncated,
            nextContinuationToken: result.NextContinuationToken
        };
    }

    async s3GetObject(bucket, key) {
        const s3 = this.getService('S3');
        const result = await s3.getObject({ Bucket: bucket, Key: key }).promise();
        return result;
    }

    async s3PutObject(bucket, key, body, options = {}) {
        const s3 = this.getService('S3');
        const params = {
            Bucket: bucket,
            Key: key,
            Body: body,
            ...options
        };

        const result = await s3.putObject(params).promise();
        return result;
    }

    async s3DeleteObject(bucket, key) {
        const s3 = this.getService('S3');
        const result = await s3.deleteObject({ Bucket: bucket, Key: key }).promise();
        return result;
    }

    async s3CreatePresignedUrl(bucket, key, operation = 'getObject', expires = 3600) {
        const s3 = this.getService('S3');
        const params = {
            Bucket: bucket,
            Key: key,
            Expires: expires
        };

        return s3.getSignedUrlPromise(operation, params);
    }

    /**
     * EC2 Operations
     */
    
    async ec2DescribeInstances(filters = []) {
        const ec2 = this.getService('EC2');
        const params = filters.length > 0 ? { Filters: filters } : {};
        
        const result = await ec2.describeInstances(params).promise();
        const instances = [];
        
        for (const reservation of result.Reservations) {
            instances.push(...reservation.Instances);
        }
        
        return instances;
    }

    async ec2StartInstances(instanceIds) {
        const ec2 = this.getService('EC2');
        const ids = Array.isArray(instanceIds) ? instanceIds : [instanceIds];
        
        const result = await ec2.startInstances({ InstanceIds: ids }).promise();
        return result.StartingInstances;
    }

    async ec2StopInstances(instanceIds) {
        const ec2 = this.getService('EC2');
        const ids = Array.isArray(instanceIds) ? instanceIds : [instanceIds];
        
        const result = await ec2.stopInstances({ InstanceIds: ids }).promise();
        return result.StoppingInstances;
    }

    async ec2CreateSnapshot(volumeId, description) {
        const ec2 = this.getService('EC2');
        const params = {
            VolumeId: volumeId,
            Description: description
        };
        
        const result = await ec2.createSnapshot(params).promise();
        return result;
    }

    /**
     * Lambda Operations
     */
    
    async lambdaListFunctions() {
        const lambda = this.getService('Lambda');
        const result = await lambda.listFunctions().promise();
        return result.Functions;
    }

    async lambdaInvoke(functionName, payload, options = {}) {
        const lambda = this.getService('Lambda');
        const params = {
            FunctionName: functionName,
            Payload: JSON.stringify(payload),
            InvocationType: options.async ? 'Event' : 'RequestResponse',
            ...options
        };

        const result = await lambda.invoke(params).promise();
        
        if (result.Payload) {
            result.Payload = JSON.parse(result.Payload);
        }
        
        return result;
    }

    async lambdaCreateFunction(config) {
        const lambda = this.getService('Lambda');
        const result = await lambda.createFunction(config).promise();
        return result;
    }

    async lambdaUpdateFunctionCode(functionName, zipBuffer) {
        const lambda = this.getService('Lambda');
        const params = {
            FunctionName: functionName,
            ZipFile: zipBuffer
        };
        
        const result = await lambda.updateFunctionCode(params).promise();
        return result;
    }

    /**
     * DynamoDB Operations
     */
    
    async dynamoListTables() {
        const dynamodb = this.getService('DynamoDB');
        const result = await dynamodb.listTables().promise();
        return result.TableNames;
    }

    async dynamoPutItem(tableName, item) {
        const dynamodb = this.getService('DynamoDB');
        const params = {
            TableName: tableName,
            Item: AWS.DynamoDB.Converter.marshall(item)
        };
        
        const result = await dynamodb.putItem(params).promise();
        return result;
    }

    async dynamoGetItem(tableName, key) {
        const dynamodb = this.getService('DynamoDB');
        const params = {
            TableName: tableName,
            Key: AWS.DynamoDB.Converter.marshall(key)
        };
        
        const result = await dynamodb.getItem(params).promise();
        return result.Item ? AWS.DynamoDB.Converter.unmarshall(result.Item) : null;
    }

    async dynamoQuery(tableName, keyCondition, options = {}) {
        const dynamodb = this.getService('DynamoDB');
        const params = {
            TableName: tableName,
            KeyConditionExpression: keyCondition,
            ...options
        };
        
        const result = await dynamodb.query(params).promise();
        return {
            items: result.Items.map(item => AWS.DynamoDB.Converter.unmarshall(item)),
            count: result.Count,
            lastEvaluatedKey: result.LastEvaluatedKey
        };
    }

    async dynamoScan(tableName, options = {}) {
        const dynamodb = this.getService('DynamoDB');
        const params = {
            TableName: tableName,
            ...options
        };
        
        const result = await dynamodb.scan(params).promise();
        return {
            items: result.Items.map(item => AWS.DynamoDB.Converter.unmarshall(item)),
            count: result.Count,
            lastEvaluatedKey: result.LastEvaluatedKey
        };
    }

    /**
     * SQS Operations
     */
    
    async sqsListQueues() {
        const sqs = this.getService('SQS');
        const result = await sqs.listQueues().promise();
        return result.QueueUrls;
    }

    async sqsSendMessage(queueUrl, messageBody, options = {}) {
        const sqs = this.getService('SQS');
        const params = {
            QueueUrl: queueUrl,
            MessageBody: typeof messageBody === 'string' ? 
                messageBody : JSON.stringify(messageBody),
            ...options
        };
        
        const result = await sqs.sendMessage(params).promise();
        return result;
    }

    async sqsReceiveMessages(queueUrl, options = {}) {
        const sqs = this.getService('SQS');
        const params = {
            QueueUrl: queueUrl,
            MaxNumberOfMessages: options.maxMessages || 10,
            WaitTimeSeconds: options.waitTime || 0,
            ...options
        };
        
        const result = await sqs.receiveMessage(params).promise();
        return result.Messages || [];
    }

    async sqsDeleteMessage(queueUrl, receiptHandle) {
        const sqs = this.getService('SQS');
        const params = {
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle
        };
        
        const result = await sqs.deleteMessage(params).promise();
        return result;
    }

    /**
     * SNS Operations
     */
    
    async snsListTopics() {
        const sns = this.getService('SNS');
        const result = await sns.listTopics().promise();
        return result.Topics;
    }

    async snsPublish(topicArn, message, options = {}) {
        const sns = this.getService('SNS');
        const params = {
            TopicArn: topicArn,
            Message: typeof message === 'string' ? 
                message : JSON.stringify(message),
            ...options
        };
        
        const result = await sns.publish(params).promise();
        return result;
    }

    async snsSubscribe(topicArn, protocol, endpoint) {
        const sns = this.getService('SNS');
        const params = {
            TopicArn: topicArn,
            Protocol: protocol,
            Endpoint: endpoint
        };
        
        const result = await sns.subscribe(params).promise();
        return result;
    }

    /**
     * CloudWatch Operations
     */
    
    async cloudwatchPutMetricData(namespace, metricData) {
        const cloudwatch = this.getService('CloudWatch');
        const params = {
            Namespace: namespace,
            MetricData: metricData
        };
        
        const result = await cloudwatch.putMetricData(params).promise();
        return result;
    }

    async cloudwatchGetMetricStatistics(namespace, metricName, options) {
        const cloudwatch = this.getService('CloudWatch');
        const params = {
            Namespace: namespace,
            MetricName: metricName,
            StartTime: options.startTime,
            EndTime: options.endTime,
            Period: options.period || 300,
            Statistics: options.statistics || ['Average'],
            ...options
        };
        
        const result = await cloudwatch.getMetricStatistics(params).promise();
        return result.Datapoints;
    }

    /**
     * IAM Operations
     */
    
    async iamListUsers() {
        const iam = this.getService('IAM');
        const result = await iam.listUsers().promise();
        return result.Users;
    }

    async iamListRoles() {
        const iam = this.getService('IAM');
        const result = await iam.listRoles().promise();
        return result.Roles;
    }

    async iamCreateUser(userName, options = {}) {
        const iam = this.getService('IAM');
        const params = {
            UserName: userName,
            ...options
        };
        
        const result = await iam.createUser(params).promise();
        return result.User;
    }

    /**
     * RDS Operations
     */
    
    async rdsDescribeDBInstances() {
        const rds = this.getService('RDS');
        const result = await rds.describeDBInstances().promise();
        return result.DBInstances;
    }

    async rdsCreateDBSnapshot(dbInstanceId, snapshotId) {
        const rds = this.getService('RDS');
        const params = {
            DBInstanceIdentifier: dbInstanceId,
            DBSnapshotIdentifier: snapshotId
        };
        
        const result = await rds.createDBSnapshot(params).promise();
        return result.DBSnapshot;
    }

    /**
     * Generic service call
     */
    async callService(serviceName, method, params = {}) {
        const service = this.getService(serviceName);
        
        if (!service[method]) {
            throw new Error(`Method ${method} not found on service ${serviceName}`);
        }

        // Check if method returns a request object
        const request = service[method](params);
        
        if (request && typeof request.promise === 'function') {
            return await request.promise();
        }
        
        return request;
    }

    /**
     * Get service quotas
     */
    async getServiceQuotas(serviceCode) {
        const quotas = this.getService('ServiceQuotas');
        const params = {
            ServiceCode: serviceCode
        };
        
        const result = await quotas.listServiceQuotas(params).promise();
        return result.Quotas;
    }

    /**
     * Assume role
     */
    async assumeRole(roleArn, sessionName) {
        const sts = this.getService('STS');
        const params = {
            RoleArn: roleArn,
            RoleSessionName: sessionName
        };
        
        const result = await sts.assumeRole(params).promise();
        
        // Create new connector with assumed role credentials
        const assumedConnector = new AWSConnector({
            credentials: {
                accessKeyId: result.Credentials.AccessKeyId,
                secretAccessKey: result.Credentials.SecretAccessKey,
                sessionToken: result.Credentials.SessionToken,
                region: this.region
            }
        });
        
        await assumedConnector.initialize();
        return assumedConnector;
    }

    /**
     * Get connection info
     */
    getConnectionInfo() {
        return {
            region: this.region,
            servicesInitialized: Array.from(this.services.keys()),
            ...this.getStatus()
        };
    }
}

module.exports = AWSConnector;