output "aws_region" {
  value = var.aws_region
}

output "s3_bucket" {
  value = aws_s3_bucket.media.id
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.media.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.media.id
}

output "backend_policy_arn" {
  value = aws_iam_policy.backend.arn
}
