# Proxy Configuration for 法源探測器 (Precedent)

## Overview

The server now supports proxy configuration to help bypass IP blocking issues when accessing the Taiwan judicial website (law.judicial.gov.tw).

## Environment Variables

Configure proxy settings using the following environment variables:

### Required Variables

- `PROXY_HOST`: The hostname or IP address of the proxy server
- `PROXY_PORT`: The port number of the proxy server

### Optional Variables

- `PROXY_PROTOCOL`: The protocol to use (`http` or `https`, defaults to `https`)
- `PROXY_AUTH`: Authentication credentials in format `username:password` (if proxy requires authentication)

## Examples

### Basic HTTPS Proxy
```bash
PROXY_HOST=proxy.example.com PROXY_PORT=8080 npm start
```

### HTTP Proxy with Custom Port
```bash
PROXY_HOST=10.0.0.100 PROXY_PORT=3128 PROXY_PROTOCOL=http npm start
```

### Authenticated Proxy
```bash
PROXY_HOST=secure-proxy.com PROXY_PORT=8080 PROXY_AUTH=myuser:mypass npm start
```

## Verification

Check if proxy is configured correctly by calling the status endpoint:

```bash
curl http://localhost:3000/api/status
```

The response will include proxy configuration information:

```json
{
  "status": "restricted",
  "proxy": {
    "enabled": true,
    "configured": true
  }
}
```

For detailed proxy configuration, use the network endpoint:

```bash
curl http://localhost:3000/api/network
```

## Features

- ✅ **HTTPS Proxy Support**: Full support for HTTPS proxies
- ✅ **HTTP Proxy Support**: Also supports HTTP proxies  
- ✅ **Authentication**: Supports username/password authentication
- ✅ **Fallback Behavior**: Maintains existing retry logic and mock data fallback
- ✅ **Status Reporting**: Proxy status included in API endpoints
- ✅ **Error Handling**: Enhanced error messages for proxy-related issues
- ✅ **Header Preservation**: All existing User-Agent and headers are maintained
- ✅ **Logging**: Detailed proxy connection logging for debugging

## Troubleshooting

### Common Issues

1. **Connection Refused**: Check if proxy server is running and accessible
2. **Authentication Failed**: Verify PROXY_AUTH credentials are correct
3. **DNS Issues**: Some proxies may require different DNS configuration

### Debugging

The server provides detailed logging when proxy is enabled:

```
Proxy configuration: {
  enabled: true,
  protocol: 'https',
  host: 'proxy.example.com',
  port: 8080,
  hasAuth: false
}
Using proxy: https://proxy.example.com:8080
Attempt 1/3 via proxy
```

## Security Considerations

- Proxy authentication credentials are passed via environment variables
- Ensure proxy server supports the required protocols and authentication methods
- Consider using HTTPS proxies for better security when possible