output "s3_bucket_arn" {
  value       = aws_s3_bucket.table_tennis_score_bucket.arn
  description = "ARN of the S3 bucket"
}

output "lambda_function_arn" {
  value       = aws_lambda_function.table_tennis_scores_lambda.arn
  description = "ARN of the Lambda function"
}
