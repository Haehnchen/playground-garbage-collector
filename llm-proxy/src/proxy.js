const axios = require('axios');
const { teeStreamAndLog } = require('./logger');

class ProxyServer {
  constructor(app, providers) {
    this.app = app;
    this.providers = providers;
    this.setupRoutes();
  }

  setupRoutes() {
    // POST /proxy/:provider/v1/messages - Anthropic-compatible messages endpoint
    this.app.post('/proxy/:provider/v1/messages', async (req, res) => {
      await this.proxyRequest(req.params.provider, 'v1/messages', req, res);
    });

    // POST /proxy/:provider/v1/messages/count_tokens - Count tokens endpoint
    this.app.post('/proxy/:provider/v1/messages/count_tokens', async (req, res) => {
      await this.proxyRequest(req.params.provider, 'v1/messages/count_tokens', req, res);
    });

    // GET /proxy/:provider/v1/models - List models for a provider
    this.app.get('/proxy/:provider/v1/models', async (req, res) => {
      await this.proxyRequest(req.params.provider, 'v1/models', req, res);
    });

    // POST /proxy/:provider/v1/chat/completions - OpenAI-compatible chat endpoint
    this.app.post('/proxy/:provider/v1/chat/completions', async (req, res) => {
      await this.proxyRequest(req.params.provider, 'v1/chat/completions', req, res);
    });

    // Models endpoint: GET /models - fetch models from all providers
    this.app.get('/models', async (req, res) => {
      const results = {};
      const providerNames = Object.keys(this.providers);

      const promises = providerNames.map(async (providerName) => {
        const providerConfig = this.providers[providerName];
        const targetUrl = `${providerConfig.baseUrl}/v1/models`;

        try {
          const headers = {};
          if (providerConfig.authToken) {
            headers.authorization = `Bearer ${providerConfig.authToken}`;
          }

          const response = await axios({
            method: 'GET',
            url: targetUrl,
            headers,
            timeout: 10000
          });

          return {
            provider: providerName,
            status: 'success',
            data: response.data
          };
        } catch (error) {
          return {
            provider: providerName,
            status: 'error',
            error: error.message,
            statusCode: error.response?.status
          };
        }
      });

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        results[response.provider] = response;
      });

      res.json({
        timestamp: new Date().toISOString(),
        providers: results
      });
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        providers: Object.keys(this.providers),
        timestamp: new Date().toISOString()
      });
    });

    // ========== AUTO ROUTES ==========
    // GET /auto/v1/models - List all models with provider prefix
    this.app.get('/auto/v1/models', async (req, res) => {
      const allModels = [];
      const providerNames = Object.keys(this.providers);

      for (const providerName of providerNames) {
        const providerConfig = this.providers[providerName];
        const targetUrl = `${providerConfig.baseUrl}/v1/models`;

        try {
          const headers = {};
          if (providerConfig.authToken) {
            headers.authorization = `Bearer ${providerConfig.authToken}`;
          }

          const response = await axios({
            method: 'GET',
            url: targetUrl,
            headers,
            timeout: 10000
          });

          // Transform model names to include provider prefix
          if (response.data && response.data.data) {
            for (const model of response.data.data) {
              const transformedModel = {
                ...model,
                id: `${providerName}/${model.id}`,
                provider: providerName
              };

              // Add provider to display_name or name
              if (model.display_name) {
                transformedModel.display_name = `${model.display_name} (${providerName})`;
              } else if (model.name) {
                transformedModel.name = `${model.name} (${providerName})`;
              }

              allModels.push(transformedModel);
            }
          }
        } catch (error) {
          // Log error but continue with other providers
          console.error(`Error fetching models from ${providerName}:`, error.message);
        }
      }

      res.json({
        object: 'list',
        data: allModels
      });
    });

    // POST /auto/v1/chat/completions - Auto-route based on model prefix
    this.app.post('/auto/v1/chat/completions', async (req, res) => {
      await this.autoProxyRequest('v1/chat/completions', req, res);
    });

    // POST /auto/v1/messages - Auto-route based on model prefix (Anthropic)
    this.app.post('/auto/v1/messages', async (req, res) => {
      await this.autoProxyRequest('v1/messages', req, res);
    });

    // POST /auto/v1/messages/count_tokens - Auto-route count tokens
    this.app.post('/auto/v1/messages/count_tokens', async (req, res) => {
      await this.autoProxyRequest('v1/messages/count_tokens', req, res);
    });
  }

  // Extract provider and clean model name from model field (e.g., "zai/claude-3-5-sonnet-20241022")
  parseModel(model) {
    if (!model || typeof model !== 'string') {
      return null;
    }
    const parts = model.split('/', 2);
    if (parts.length === 2 && this.providers[parts[0]]) {
      return { provider: parts[0], modelName: parts[1] };
    }
    return null;
  }

  async autoProxyRequest(path, req, res) {
    // Extract model from request body
    const model = req.body?.model;
    const parsed = this.parseModel(model);

    if (!parsed) {
      return res.status(400).json({
        error: {
          message: `Invalid or missing model. Expected format: "provider/modelName". Available providers: ${Object.keys(this.providers).join(', ')}`,
          type: 'invalid_request_error'
        }
      });
    }

    // Create a modified request with the cleaned model name
    const modifiedReq = {
      ...req,
      body: {
        ...req.body,
        model: parsed.modelName
      }
    };

    // Proxy to the extracted provider
    await this.proxyRequest(parsed.provider, path, modifiedReq, res);
  }

  async proxyRequest(provider, path, req, res) {
    const startTime = Date.now();

    const providerConfig = this.providers[provider];

    if (!providerConfig) {
      return res.status(400).json({
        error: `Unknown provider: ${provider}. Available providers: ${Object.keys(this.providers).join(', ')}`
      });
    }

    const targetUrl = `${providerConfig.baseUrl}/${path}`;
    const queryParams = req.query;

    try {
      const headers = { ...req.headers };
      delete headers.host;

      if (providerConfig.authToken) {
        headers.authorization = `Bearer ${providerConfig.authToken}`;
      }

      const response = await axios({
        method: req.method,
        url: targetUrl,
        headers,
        data: req.body,
        params: queryParams,
        validateStatus: () => true,
        responseType: 'stream'
      });

      const duration = Date.now() - startTime;

      console.log(`[PROXY] ${provider} ${path} -> ${response.status} (${duration}ms)`);

      res.status(response.status);
      Object.keys(response.headers).forEach(key => {
        res.setHeader(key, response.headers[key]);
      });

      if (path.includes('messages')) {
        teeStreamAndLog(response.data, req.body, response.headers['content-type']).pipe(res);
      } else {
        response.data.pipe(res);
      }

    } catch (error) {
      const duration = Date.now() - startTime;

      if (error.response) {
        console.log(`[PROXY] ${provider} ${path} -> ${error.response.status} (${duration}ms) ERROR`);
        res.status(error.response.status);
        Object.keys(error.response.headers).forEach(key => {
          res.setHeader(key, error.response.headers[key]);
        });
        error.response.data.pipe(res);
      } else if (error.request) {
        res.status(502).json({
          error: 'Bad Gateway',
          message: 'No response received from upstream server'
        });
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: error.message
        });
      }
    }
  }
}

module.exports = ProxyServer;
