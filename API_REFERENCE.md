# API Reference

Welcome to the API reference. This API is organized around REST. Our API has predictable resource-oriented URLs, accepts JSON-encoded request bodies, returns JSON-encoded responses, and uses standard HTTP response codes, authentication, and verbs.

## Authentication

The API uses Bearer Token authentication. You can obtain a token by signing up or logging in.

Include the token in the `Authorization` header for all protected requests:

```bash
Authorization: Bearer <your_token>
```

---

## Auth

### Create a user
Creates a new user account.

<span class="method post">POST</span> `/v1/auth/signup`

#### Parameters

| Name | Type | Description |
| :--- | :--- | :--- |
| `name` | string | **Required**. The full name of the user. |
| `email` | string | **Required**. The email address of the user. |
| `password` | string | **Required**. The password for the account. |

#### Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR...",
    "user": {
      "id": "cm4...",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2023-10-27T10:00:00.000Z",
      "updated_at": "2023-10-27T10:00:00.000Z"
    }
  },
  "message": "User created successfully"
}
```

---

### Login
Authenticates a user and returns a JWT token.

<span class="method post">POST</span> `/v1/auth/login`

#### Parameters

| Name | Type | Description |
| :--- | :--- | :--- |
| `email` | string | **Required**. The email address of the user. |
| `password` | string | **Required**. The password for the account. |

#### Response

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR...",
    "user": {
      "id": "cm4...",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2023-10-27T10:00:00.000Z",
      "updated_at": "2023-10-27T10:00:00.000Z"
    }
  },
  "message": "Login successful"
}
```

---

### Retrieve current user
Retrieves the details of the currently authenticated user.

<span class="method get">GET</span> `/v1/auth/me`

#### Response

```json
{
  "success": true,
  "data": {
    "id": "cm4...",
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2023-10-27T10:00:00.000Z",
    "updated_at": "2023-10-27T10:00:00.000Z",
    "organizations": [
      {
        "id": "cm4...",
        "name": "Acme Corp",
        "slug": "acme-corp",
        "role": "ADMIN"
      }
    ]
  },
  "message": "User data fetched successfully"
}
```

---

## Organizations

### Create an organization
Creates a new organization. This endpoint generates a business brief using AI based on the provided details.

**Requires Authentication**

<span class="method post">POST</span> `/v1/organizations`

#### Parameters

| Name | Type | Description |
| :--- | :--- | :--- |
| `name` | string | **Required**. The name of the organization. |
| `business_type` | string | **Required**. The type of business (e.g., "Ropa y moda"). |
| `main_product` | string | **Required**. The main product or service. |
| `content_objective` | string | **Required**. The objective of the content (e.g., "Ventas"). |
| `target_audience` | string | **Required**. The target audience description. |

#### Response

```json
{
  "success": true,
  "data": {
    "organization": {
      "id": "cm4...",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "business_type": "Technology",
      "main_product": "SaaS Platform",
      "content_objective": "Awareness",
      "target_audience": "Startups",
      "business_brief": "Acme Corp is a technology company...",
      "created_at": "2023-10-27T10:00:00.000Z",
      "updated_at": "2023-10-27T10:00:00.000Z"
    }
  },
  "message": "Organization created successfully"
}
```

---

### List all organizations
Returns a list of organizations that the current user belongs to.

<span class="method get">GET</span> `/v1/organizations`

#### Response

```json
{
  "success": true,
  "data": {
    "organizations": [
      {
        "id": "cm4...",
        "name": "Acme Corp",
        "slug": "acme-corp",
        "role": "ADMIN",
        "created_at": "2023-10-27T10:00:00.000Z",
        "updated_at": "2023-10-27T10:00:00.000Z"
      }
    ]
  },
  "message": "Organizations fetched successfully"
}
```
