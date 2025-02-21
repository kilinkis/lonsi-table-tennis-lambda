resource "aws_api_gateway_rest_api" "table_tennis_scores_api" {
  name        = "TableTennisScoresAPI"
  description = "API for accessing table tennis scores"
}

resource "aws_api_gateway_resource" "table_tennis_scores_resource" {
  rest_api_id = aws_api_gateway_rest_api.table_tennis_scores_api.id
  parent_id   = aws_api_gateway_rest_api.table_tennis_scores_api.root_resource_id
  path_part   = "scores"
}

resource "aws_api_gateway_method" "table_tennis_scores_get" {
  rest_api_id   = aws_api_gateway_rest_api.table_tennis_scores_api.id
  resource_id   = aws_api_gateway_resource.table_tennis_scores_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "table_tennis_scores_lambda_integration" {
  rest_api_id             = aws_api_gateway_rest_api.table_tennis_scores_api.id
  resource_id             = aws_api_gateway_resource.table_tennis_scores_resource.id
  http_method             = aws_api_gateway_method.table_tennis_scores_get.http_method
  integration_http_method = "POST"
  type                    = "AWS"
  uri                     = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${aws_lambda_function.table_tennis_scores_lambda.arn}/invocations"
  timeout_milliseconds    = 29000 // Set to 29 seconds (max allowed)
}

resource "aws_lambda_permission" "table_tennis_scores_api_permission" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.table_tennis_scores_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.table_tennis_scores_api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "table_tennis_scores_deployment" {
  depends_on = [
    aws_api_gateway_integration.table_tennis_scores_lambda_integration,
    aws_api_gateway_integration_response.table_tennis_scores_integration_response,
    aws_api_gateway_integration.options,
    aws_api_gateway_integration_response.options
  ]

  rest_api_id = aws_api_gateway_rest_api.table_tennis_scores_api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_integration_response.table_tennis_scores_integration_response,
      aws_api_gateway_method_response.table_tennis_scores_method_response,
      aws_api_gateway_integration_response.options
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "table_tennis_scores_stage" {
  deployment_id = aws_api_gateway_deployment.table_tennis_scores_deployment.id
  rest_api_id   = aws_api_gateway_rest_api.table_tennis_scores_api.id
  stage_name    = "prod"
}

resource "aws_api_gateway_method_settings" "table_tennis_scores_method_settings" {
  rest_api_id = aws_api_gateway_rest_api.table_tennis_scores_api.id
  stage_name  = aws_api_gateway_stage.table_tennis_scores_stage.stage_name
  method_path = "*/*"

  settings {
    logging_level      = "INFO"
    metrics_enabled    = true
    data_trace_enabled = true
  }
}

resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "API-Gateway-Execution-Logs-${aws_api_gateway_rest_api.table_tennis_scores_api.id}/${aws_api_gateway_stage.table_tennis_scores_stage.stage_name}"
  retention_in_days = 30
}

resource "aws_api_gateway_method_response" "table_tennis_scores_method_response" {
  rest_api_id = aws_api_gateway_rest_api.table_tennis_scores_api.id
  resource_id = aws_api_gateway_resource.table_tennis_scores_resource.id
  http_method = aws_api_gateway_method.table_tennis_scores_get.http_method
  status_code = "200"

  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

resource "aws_api_gateway_integration_response" "table_tennis_scores_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.table_tennis_scores_api.id
  resource_id = aws_api_gateway_resource.table_tennis_scores_resource.id
  http_method = aws_api_gateway_method.table_tennis_scores_get.http_method
  status_code = aws_api_gateway_method_response.table_tennis_scores_method_response.status_code

  response_templates = {
    "application/json" = ""
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin"  = "'*'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'",
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"
  }
}

resource "aws_api_gateway_gateway_response" "cors" {
  rest_api_id   = aws_api_gateway_rest_api.table_tennis_scores_api.id
  response_type = "DEFAULT_4XX"

  response_templates = {
    "application/json" = "{'message':$context.error.messageString}"
  }

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'*'",
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
  }
}

# Add another for 5XX errors
resource "aws_api_gateway_gateway_response" "cors_5xx" {
  rest_api_id   = aws_api_gateway_rest_api.table_tennis_scores_api.id
  response_type = "DEFAULT_5XX"

  response_templates = {
    "application/json" = "{'message':$context.error.messageString}"
  }

  response_parameters = {
    "gatewayresponse.header.Access-Control-Allow-Origin"  = "'*'",
    "gatewayresponse.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "gatewayresponse.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'"
  }
}

# Add OPTIONS method
resource "aws_api_gateway_method" "options" {
  rest_api_id   = aws_api_gateway_rest_api.table_tennis_scores_api.id
  resource_id   = aws_api_gateway_resource.table_tennis_scores_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Add OPTIONS method response
resource "aws_api_gateway_method_response" "options_200" {
  rest_api_id = aws_api_gateway_rest_api.table_tennis_scores_api.id
  resource_id = aws_api_gateway_resource.table_tennis_scores_resource.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# Add OPTIONS integration
resource "aws_api_gateway_integration" "options" {
  rest_api_id = aws_api_gateway_rest_api.table_tennis_scores_api.id
  resource_id = aws_api_gateway_resource.table_tennis_scores_resource.id
  http_method = aws_api_gateway_method.options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# Add OPTIONS integration response
resource "aws_api_gateway_integration_response" "options" {
  rest_api_id = aws_api_gateway_rest_api.table_tennis_scores_api.id
  resource_id = aws_api_gateway_resource.table_tennis_scores_resource.id
  http_method = aws_api_gateway_method.options.http_method
  status_code = aws_api_gateway_method_response.options_200.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
