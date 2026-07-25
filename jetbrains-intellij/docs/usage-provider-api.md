# Junie Usage API

*Created: 2026-07-25*

The Junie Usage API returns the remaining credit balance and active license tier for a Junie account. Different license types define available quotas:

| `licenseType` | Display Name | Description |
|---|---|---|
| `JUNP` | EAP | Early Access Program (free preview) |
| `TRIAL` | Trial | Trial period |
| `AIF` | Free | Free tier |
| `AIP` | Pro | Paid Pro subscription |
| `AIU` | Ultimate | Paid Ultimate subscription |
| `NONE` | — | No active license |

## Endpoint

```
GET https://ingrazzio-cloud-prod.labs.jb.gg/auth/test
```

## Curl

```bash
curl -s https://ingrazzio-cloud-prod.labs.jb.gg/auth/test \
  -H "Authorization: Bearer perm-xxxxxxxxxxxx" \
  -H "Accept: application/json" \
  -H "X-Accept-EAP-License: true" | jq
```

## Response

```json
{
  "balanceLeft": 297.73,
  "balanceUnit": "USD",
  "licenseType": "JUNP",
  "active": true
}
```

## Fields

| Field | Type | Description |
|---|---|---|
| `balanceLeft` | `double` | Remaining credit balance |
| `balanceUnit` | `string` | Currency unit, e.g. `"USD"` |
| `licenseType` | `string` | Active license tier (see table above) |
| `active` | `boolean` | `false` means the account is inactive or expired |
