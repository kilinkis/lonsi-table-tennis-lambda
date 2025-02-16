variable "aws_region" {
  type        = string
  default     = "eu-central-1"
  description = "AWS Region"
}

variable "s3_bucket_name" {
  type        = string
  default     = "table-tennis-score"
  description = "Name of the S3 bucket"
}

variable "lambda_function_name" {
  type        = string
  default     = "scrapeTableTennis"
  description = "Name of the Lambda function"
}

variable "lambda_runtime" {
  type        = string
  default     = "nodejs18.x"
  description = "Runtime for the Lambda function"
}
