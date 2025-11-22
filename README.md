# PGP Mailer Serverless API (Python/Flask)

This repository contains a Vercel Serverless Function built with Python and Flask, designed to perform client-side PGP encryption of form data using a pre-uploaded public key. It then generates a secure mailto: link for the client to send the encrypted message.

It was created as a fix for deployment issues encountered with the openpgp.js library in a Node.js Vercel environment.

## 🚀 How It Works

The core function is located at `api/index.py`. When a client makes a POST request to the `/api` endpoint, the function performs the following steps:

- *Loads Public Key*: Reads the recipient's PGP public key from `sudohopex-email-pub-key.asc`.

- *Encrypts Message*: Uses the `pgpy` library to encrypt the user's name, email, and message body using the public key.

- *Generates mailto URL*: Constructs a `mailto:` URL containing the encrypted PGP message as the body and encodes all components.

- *Returns URL*: Sends the finalized mailto URL back to the client.


## ⚙️ Setup and Dependencies

1. Project Structure

Your project structure should look like this:
```
pgp-mailer-api/
├── api/
│   └── index.py             # The Python Serverless Function
├── requirements.txt         # Python dependencies
├── index.html               # The client-side form (must be updated)
├── sudohohopex-email-pub-key.asc # Your PGP Public Key file
└── package.json             # Minimal Vercel configuration
```

2. Dependencies (`requirements.txt`)

These dependencies are required for the Python environment to run Flask and handle PGP encryption.
```
Flask>=2.3.0  # Stable version to avoid Werkzeug conflicts
pgpy>=0.6.0   # The Python PGP library
```

3. Public Key File

Ensure your recipient's PGP public key is placed in the root directory of your repository, named exactly:

`sudohopex-email-pub-key.asc`

The key format must start with `-----BEGIN PGP PUBLIC KEY BLOCK-----` and end with `-----END PGP PUBLIC KEY BLOCK-----`.

## 💻 Usage (Client-Side)

The API expects a POST request with JSON data.

*Request Endpoint*
- *URL*: `https://[YOUR-VERCEL-DOMAIN]/api`
- *Method*: `POST`
- *Content-Type*: `application/json`
- *Request Body* `(JSON)`

The client form data must be packaged into a JSON object containing the following keys:

|Key|Type  | Description |
|---|------|-------|
|name | string | Sender's name. |
|email | string | Sender's email address. |
| message | string | The plain text content to be encrypted. |
| recipient | string | The destination email address (e.g., info@sudohopex.com). |
| subjectLine | string | (Optional) The subject line for the resulting email. Defaults to `[PGP] Secure Message`. |


*Example Request Body*:
```
{
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "message": "This is a test of the secure PGP email system.",
    "recipient": "recipient@example.com",
    "subjectLine": "Secure Inquiry"
}
```

*Response*:
The API will return a JSON object containing the mailtoUrl.

|Key|Type  | Description |
|---|------|-------|
|success | boolean | true if encryption succeeded. |
| mailtoUrl | string | The URL containing the encrypted body, ready to be used by the client to open an email program. |


*Example Successful Response*:
```
{
    "success": true,
    "mailtoUrl": "mailto:recipient@example.com?subject=Secure%20Inquiry&body=-----BEGIN%20PGP%20MESSAGE-----...[ENCRYPTED%20BLOB]...-----END%20PGP%20MESSAGE-----"
}
```


The client-side JavaScript should then redirect the user to this URL (e.g., `using window.location.href = response.mailtoUrl`).

## ⚠️ Troubleshooting

*ImportError: cannot import name 'url_quote'*: The Flask version is too old. Ensure `requirements.txt` has `Flask>=2.3.0`.

*ImportError: cannot import name 'PGPMessge'*: Check for typos in `api/index.py`. The correct class name is `PGPMessage`.

*Server key file not found*: Ensure the `sudohopex-email-pub-key.asc` file is in the root directory and the path defined in `api/index.py` is correct: `PUBLIC_KEY_PATH = os.path.join(os.path.dirname(__file__), '..', 'sudohopex-email-pub-key.asc')`.

*PGP encryption error*: This usually indicates an issue with the public key file itself (corrupted, wrong format, or permissions issue). Verify the key is correctly formatted and not password protected.

## 
![Made with Lov3 by SudoHopeX](https://hope.is-a.dev/img/made-with-love-by-sudohopex.png)
