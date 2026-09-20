# Swiply media storage

This module creates a private S3 bucket, a CloudFront distribution with Origin
Access Control, multipart-upload CORS and lifecycle rules, and a least-privilege
backend IAM policy.

Copy `terraform.tfvars.example` to `terraform.tfvars`, choose a globally unique
bucket name, then run `terraform init` and `terraform apply`. Attach the output
`backend_policy_arn` to the backend's execution role. Map the remaining outputs
to the backend environment variables documented in `backend/.env.example`.
