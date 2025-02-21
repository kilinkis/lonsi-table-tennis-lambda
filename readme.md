# Table Tennis Scores Terraform Configuration

This repository contains a Terraform configuration for managing AWS resources related to scraping and storing table tennis scores. The configuration includes:

- An S3 bucket for storing scores.
- An IAM role and user for managing resources.
- An IAM policy for managing IAM resources.
- A Lambda function with a layer for scraping scores.

```mermaid
graph TD
    %% API Gateway Setup %%
    A[aws_api_gateway_rest_api.table_tennis_scores_api] --> B[aws_api_gateway_resource.table_tennis_scores_resource (/scores)]
    B --> C[aws_api_gateway_method.table_tennis_scores_get (GET)]
    B --> D[aws_api_gateway_method.options (OPTIONS)]

    %% Lambda Integration %%
    C --> E[aws_api_gateway_integration.table_tennis_scores_lambda_integration]
    E --> F[aws_lambda_function.table_tennis_scores_lambda]
    F --> G[aws_lambda_permission.table_tennis_scores_api_permission]

    %% OPTIONS Preflight Setup %%
    D --> H[aws_api_gateway_integration.options (MOCK)]
    D --> I[aws_api_gateway_method_response.options_200]
    H --> J[aws_api_gateway_integration_response.options]

    %% Method Responses %%
    C --> K[aws_api_gateway_method_response.table_tennis_scores_method_response]
    E --> L[aws_api_gateway_integration_response.table_tennis_scores_integration_response]

    %% Deployment and Stage %%
    A --> M[aws_api_gateway_deployment.table_tennis_scores_deployment]
    M --> N[aws_api_gateway_stage.table_tennis_scores_stage (prod)]

    %% Logging and Monitoring %%
    N --> O[aws_api_gateway_method_settings.table_tennis_scores_method_settings]
    A --> P[aws_cloudwatch_log_group.api_gateway_logs]

    %% Gateway Responses for CORS %%
    A --> Q[aws_api_gateway_gateway_response.cors (DEFAULT_4XX)]
    A --> R[aws_api_gateway_gateway_response.cors_5xx (DEFAULT_5XX)]

    %% S3 Bucket for Caching Data (Optional) %%
    F --> S3[s3_bucket.table_tennis_cache_bucket]
    S3 --> T[s3_object.cached_data.json]

    %% CloudWatch Logs for Lambda %%
    F --> U[cloudwatch_log_group.lambda_execution_logs]
```

## Prerequisites

- AWS account with necessary permissions.
- Terraform installed on your machine.
- Node.js and AWS CLI for developing and deploying the Lambda function.

## Usage

1. Clone this repository.
2. Initialize Terraform by running `terraform init`.
3. Apply the configuration using `terraform apply`.

## TODO
1. fix wp urls