# Configure the AWS Provider
provider "aws" {
  region = var.aws_region
}

# S3 Bucket for storing table tennis scores
resource "aws_s3_bucket" "table_tennis_score_bucket" {
  bucket = var.s3_bucket_name
}

# IAM Role for Lambda execution
resource "aws_iam_role" "table_tennis_scores_role" {
  name        = "table-tennis-scores"
  description = "Allows Lambda functions to call AWS services on your behalf."

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Effect = "Allow"
      }
    ]
  })
}

# IAM User for managing resources
resource "aws_iam_user" "table_tennis_scores_user" {
  name = "table-tennis-scores"
}

# IAM Policy for managing IAM resources
resource "aws_iam_policy" "terraform_iam_management_policy" {
  name        = "TerraformIAMManagementPolicy"
  description = "Policy for managing IAM resources with Terraform"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "iam:CreateRole",
          "iam:GetUser",
          "iam:ListAttachedUserPolicies",
          "iam:ListUserPolicies",
          "iam:GetRole",
          "iam:UpdateRoleDescription",
          "iam:CreatePolicy",
          "iam:DeletePolicy",
          "iam:DeletePolicyVersion",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:ListPolicies",
          "iam:ListPolicyVersions",
          "iam:ListEntitiesForPolicy",
          "iam:DetachUserPolicy",
          "iam:DetachRolePolicy",
          "iam:AttachRolePolicy",
          "iam:CreatePolicyVersion",
          "iam:PassRole",
          "apigateway:POST",
          "apigateway:GET",
          "apigateway:PUT",
          "apigateway:DELETE",
          "apigateway:PATCH",
          "logs:CreateLogGroup",
          "logs:PutRetentionPolicy",
          "logs:ListTagsForResource",
          "logs:DeleteLogGroup"
        ]
        Resource = "*"
      }
    ]
  })
}

# IAM Policy for Lambda execution
resource "aws_iam_policy" "lambda_execution_policy" {
  name        = "LambdaExecutionPolicy"
  description = "Policy for Lambda execution"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
        Effect   = "Allow"
      },
      {
        Action = [
          "s3:GetObject"
        ]
        Resource = aws_s3_bucket.table_tennis_score_bucket.arn
        Effect   = "Allow"
      }
    ]
  })
}

# IAM Policy for logging 
resource "aws_iam_policy" "cloudwatch_logging_policy" {
  name        = "CloudWatchLoggingPolicy"
  description = "Policy for CloudWatch logging"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchAccess1"
        Effect = "Allow"
        Action = [
          "logs:GetLogEvents",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:*:log-stream:*"
      },
      {
        Sid    = "CloudWatchAccess2"
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:FilterLogEvents",
          "logs:CreateLogGroup"
        ]
        Resource = "arn:aws:logs:*:*:log-group:*"
      }
    ]
  })
}

# Attach Lambda execution policy to the IAM role
resource "aws_iam_role_policy_attachment" "lambda_execution_attach" {
  role       = aws_iam_role.table_tennis_scores_role.name
  policy_arn = aws_iam_policy.lambda_execution_policy.arn
}

# IAM Role for CloudWatch logging
resource "aws_iam_role" "cloudwatch_logging_role" {
  name        = "CloudWatchLoggingRole"
  description = "Role for CloudWatch logging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
        Effect = "Allow"
      }
    ]
  })
}

# Attach CloudWatch logging policy to the IAM role
resource "aws_iam_role_policy_attachment" "cloudwatch_logging_policy_attachment" {
  role       = aws_iam_role.cloudwatch_logging_role.name
  policy_arn = aws_iam_policy.cloudwatch_logging_policy.arn
}

# Attach IAM management policy to the IAM user
resource "aws_api_gateway_account" "api_gateway_cloudwatch_account" {
  cloudwatch_role_arn = aws_iam_role.cloudwatch_logging_role.arn
}

# Lambda layer for dependencies
data "aws_lambda_layer_version" "puppeteer_chrome_layer" {
  layer_name = "my-dependencies-layer"
  version    = "3"
}

# Lambda function for scraping table tennis scores
resource "aws_lambda_function" "table_tennis_scores_lambda" {
  filename      = "../lambda/function.zip"
  function_name = "scrapeTableTennis"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  timeout       = 300
  memory_size   = 1024
  role          = aws_iam_role.table_tennis_scores_role.arn

  layers = [data.aws_lambda_layer_version.puppeteer_chrome_layer.arn]
}
