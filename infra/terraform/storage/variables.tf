variable "aws_region" {
  description = "AWS region for the media bucket."
  type        = string
}

variable "bucket_name" {
  description = "Globally unique private S3 bucket name."
  type        = string
}

variable "allowed_origins" {
  description = "Frontend origins allowed to upload directly with presigned URLs."
  type        = list(string)
}

variable "backend_policy_name" {
  description = "Name of the IAM policy attached to the backend execution role."
  type        = string
  default     = "swiply-media-backend"
}

variable "tags" {
  description = "Tags applied to storage resources."
  type        = map(string)
  default     = {}
}
