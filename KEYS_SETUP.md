# Swiply credentials and BYOK setup

Swiply uses two separate kinds of credentials:

1. **Swiply operator credentials** configure the backend, storage, OAuth and
   billing. Only the app owner/deployment team handles these.
2. **User-provided keys (BYOK)** are entered inside Swiply. AI keys are personal;
   Buffer and Postiz publishing keys belong to the workspace so scheduled jobs
   continue working for the whole team.

Never show infrastructure, social OAuth, AWS, database or billing secrets to
users. Never commit `.env` or paste real secrets into source code.

## App owner: required backend credentials

Copy `backend/.env.example` to `backend/.env`, then configure these values.

| Variable | Where to get it |
|---|---|
| `MONGODB_URI` | Create a free cluster in [MongoDB Atlas](https://cloud.mongodb.com/), add your IP and database user, then choose **Connect → Drivers** and copy the connection string. For local development, use `mongodb://127.0.0.1:27017/swiply`. |
| `JWT_SECRET` | Generate locally: `openssl rand -base64 48` |
| `ENCRYPTION_KEY` | Generate locally: `openssl rand -hex 32` |

## App owner: AWS S3 and CloudFront

Use temporary AWS credentials through an IAM role or AWS SSO instead of creating
permanent access keys. Configure the AWS CLI with `aws configure sso`, then log in
with `aws sso login --profile YOUR_PROFILE` and set `AWS_PROFILE=YOUR_PROFILE`.
See the [official AWS CLI authentication guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-authentication.html).

Provision storage from this repository:

```bash
cd infra/terraform/storage
cp terraform.tfvars.example terraform.tfvars
# Set a globally unique bucket_name and your frontend allowed_origins.
terraform init
terraform apply
```

Copy the Terraform outputs into these variables:

```dotenv
AWS_REGION=
S3_BUCKET=
CLOUDFRONT_DOMAIN=
CLOUDFRONT_DISTRIBUTION_ID=
```

Attach the output `backend_policy_arn` to the IAM role or user that runs the
backend. That policy must include `s3:PutObject`, `s3:GetObject`,
`s3:DeleteObject`, multipart actions, `s3:ListBucket`, and
`cloudfront:CreateInvalidation`. If library deletes fail with `AccessDenied`,
the credentials in use are missing `s3:DeleteObject`.
`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are only needed if you choose
long-lived IAM credentials; the application normally uses the AWS credential chain.

## App owner: service integrations

These keys belong to Swiply itself. Users must never be asked for them.

| Variables | Where and how |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | In [Google Cloud credentials](https://console.cloud.google.com/apis/credentials), create an OAuth **Web application**. Register `http://localhost:3000/api/auth/google/callback` for local development, changing the port if your backend uses another one. |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Create an app in the [TikTok Developer portal](https://developers.tiktok.com/), enable Login Kit and Content Posting, then copy the client key and secret. |
| `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` | Create an app in [Meta for Developers](https://developers.facebook.com/apps/), add the Instagram/Facebook products, and copy the app ID/secret. You create the webhook verification token yourself as a long random value. |
| `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` | Create a project/app in the [X Developer Portal](https://developer.x.com/en/portal/dashboard), enable OAuth 2.0, and copy the client ID and secret. Set `TWITTER_API_TIER` to your actual plan. |
| `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` | Create an app in [Pinterest Developers](https://developers.pinterest.com/apps/). Register `{API_BASE_URL}/api/social-accounts/callback/pinterest` as the redirect URI. Request `user_accounts:read`, `boards:read`, and `pins:read`. |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Create an app in [LinkedIn Developers](https://www.linkedin.com/developers/apps). The adapter is not implemented yet. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Use test keys from the [Stripe API keys page](https://dashboard.stripe.com/test/apikeys). Create a webhook endpoint in Stripe Workbench and reveal its separate signing secret. Billing is not implemented yet. |
| `RESEND_API_KEY` | Create a key in [Resend](https://resend.com/api-keys) after adding and verifying your sending domain. Email delivery is not implemented yet. |
| `REDIS_URL` | Local: `redis://127.0.0.1:6379`. For production, copy the TLS connection URL from your managed Redis provider. |
| `TIKAPI_KEY` | Create a key in [TikAPI](https://tikapi.io/). Official TikTok APIs cannot search competitors; Swiply uses TikAPI public search and hashtag feeds to see what is posting in the product niche. Optional `TIKAPI_SANDBOX=true` hits their sandbox. |

## Users: AI provider keys only

Users enter provider keys in Swiply's AI settings, not in the server `.env`.
Usage is billed directly to their provider account. Swiply validates and
encrypts each key at rest, returns only its last four characters, and uses it
only for that user's AI requests.

| Provider | Where the user creates a key |
|---|---|
| OpenAI | Create a secret key on the [OpenAI API keys page](https://platform.openai.com/api-keys). The key must have access to the model selected in Swiply. |
| Anthropic | Create a key in the [Anthropic Console](https://console.anthropic.com/settings/keys). Add billing and ensure the selected Claude model is available. |
| Google Gemini | Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey). The associated Google Cloud project must have Gemini API access. |

The web settings screen uses `GET /api/ai/providers`, `GET /api/ai/models`, and
`GET|PUT|DELETE /api/ai/credentials/:provider`. The existing OpenAI-specific
route remains compatible. A full key is accepted only by a `PUT` request and is
never returned by the API.

OAuth redirect URLs must exactly match the backend routes and `API_BASE_URL`.
For social providers, use:
`{API_BASE_URL}/api/social-accounts/callback/{tiktok|instagram|twitter}`.

## Workspace admins: Buffer or Postiz publishing keys

Swiply can publish through accounts users have already connected in Buffer or
Postiz, so deployment-owned TikTok, Meta, X, Pinterest, or LinkedIn credentials
are not required for those channels.

| Provider | Where to create the key |
|---|---|
| Buffer | Sign in as the Buffer organization owner, open [Buffer API settings](https://publish.buffer.com/settings/api), and create a personal API key. |
| Postiz | Follow the [Postiz public API setup](https://docs.postiz.com/public-api/introduction), then open **Settings → Developers → Public API** in Postiz and copy the API key. For self-hosted Postiz, also enter its public HTTPS origin, such as `https://postiz.example.com`. |

In Swiply, open **Social accounts**, connect Buffer or Postiz, paste the key,
choose the provider organization/channels, and save the required publishing
defaults. Keys are encrypted at rest and responses expose only the last four
characters. Never place a user's Buffer or Postiz key in an environment file.
