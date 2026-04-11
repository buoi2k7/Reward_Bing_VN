// =============================================
// API NETWORK HANDLER - Robust API Calls
// Handles retries, timeout optimization, connection pooling
// =============================================

// Pool of active connections + cache
const networkPool = {
  activeRequests: new Map(),
  responseCache: new Map(),
  lastSuccessTime: {},
  failureCount: {},
  
  // Cache responses for 5 minutes
  CACHE_TTL: 5 * 60 * 1000,
  
  // Timeout strategy: dynamic based on failure history
  getTimeout(endpoint) {
    const failures = this.failureCount[endpoint] || 0;
    const baseTimeout = 12000; // 12 seconds (was 8)
    // Increase timeout by 3 seconds per consecutive failure
    return baseTimeout + (failures * 3000);
  },
  
  // Get cached response if valid
  getCached(url) {
    const cached = this.responseCache.get(url);
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.CACHE_TTL) {
      this.responseCache.delete(url);
      return null;
    }
    return cached.data;
  },
  
  // Store cache
  setCached(url, data) {
    this.responseCache.set(url, {
      data,
      timestamp: Date.now()
    });
  },
  
  // Track success - reset failure counter
  markSuccess(endpoint) {
    this.failureCount[endpoint] = 0;
    this.lastSuccessTime[endpoint] = Date.now();
  },
  
  // Track failure
  markFailure(endpoint) {
    this.failureCount[endpoint] = (this.failureCount[endpoint] || 0) + 1;
  }
};

/**
 * Robust fetch with retry logic and intelligent timeouts
 * @param {string} endpoint - API path (e.g., '/api/getuserinfo?type=1')
 * @param {object} options - fetch options
 * @param {number} maxRetries - max retry attempts (default: 3)
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(endpoint, options = {}, maxRetries = 3) {
  const fullUrl = endpoint.startsWith('http') 
    ? endpoint 
    : `${location.origin}${endpoint}`;
  
  // Check cache first (skip for POST/PUT)
  if (options.method !== 'POST' && options.method !== 'PUT') {
    const cached = networkPool.getCached(fullUrl);
    if (cached) {
      console.log(`[API] Cache hit: ${endpoint}`);
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
      });
    }
  }
  
  // Check if already pending
  const pendingKey = fullUrl + JSON.stringify(options);
  if (networkPool.activeRequests.has(pendingKey)) {
    console.log(`[API] Reusing pending request: ${endpoint}`);
    return networkPool.activeRequests.get(pendingKey);
  }
  
  // Setup default options
  const fetchOptions = {
    cache: 'no-cache',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };
  
  // Handle retries
  const performFetch = async (attempt) => {
    return new Promise((resolve, reject) => {
      const timeout = networkPool.getTimeout(endpoint) + (attempt * 2000); // Extra delay per retry
      const controller = new AbortController();
      
      let timeoutHandle = setTimeout(() => {
        controller.abort();
        reject(new Error(`TIMEOUT_${timeout}ms`));
      }, timeout);
      
      console.log(`[API] Attempt ${attempt + 1}/${maxRetries + 1}: ${endpoint} (timeout: ${timeout}ms)`);
      
      fetch(fullUrl, {
        ...fetchOptions,
        signal: controller.signal
      })
        .then(response => {
          clearTimeout(timeoutHandle);
          resolve(response);
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          console.error(`[API] Fetch error on attempt ${attempt + 1}:`, error.message);
          reject(error);
        });
    });
  };
  
  // Create promise for this request
  const requestPromise = (async () => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await performFetch(attempt);
        
        // Check response status
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            // Auth error - don't retry
            networkPool.markFailure(endpoint);
            throw new Error(`AUTH_ERROR_${response.status}`);
          }
          
          if (attempt < maxRetries) {
            console.warn(`[API] HTTP ${response.status}, retrying...`);
            lastError = new Error(`HTTP_${response.status}`);
            // Wait before retry (exponential backoff)
            await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
            continue;
          }
          
          networkPool.markFailure(endpoint);
          throw new Error(`HTTP_${response.status}`);
        }
        
        // Success
        const data = await response.clone().json().catch(() => null);
        if (data) {
          networkPool.setCached(fullUrl, data);
        }
        
        networkPool.markSuccess(endpoint);
        networkPool.activeRequests.delete(pendingKey);
        
        // Return successful response
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-Source': 'API' }
        });
        
      } catch (error) {
        lastError = error;
        console.error(`[API] Error on attempt ${attempt + 1}: ${lastError.message}`);
        
        // Determine if we should retry
        const shouldRetry = 
          error.message.startsWith('TIMEOUT') ||
          error.message.startsWith('NetworkError') ||
          error.message.startsWith('HTTP_429') || // Rate limit
          error.message.startsWith('HTTP_502') || // Bad gateway
          error.message.startsWith('HTTP_503') || // Service unavailable
          error.message.startsWith('HTTP_504');   // Gateway timeout
        
        if (!shouldRetry || attempt >= maxRetries) {
          networkPool.markFailure(endpoint);
          networkPool.activeRequests.delete(pendingKey);
          throw lastError;
        }
        
        // Exponential backoff before retry
        const backoffMs = Math.min(1000 * Math.pow(1.5, attempt + 1), 10000);
        console.log(`[API] Backoff ${backoffMs}ms before retry...`);
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }
    
    // All retries exhausted
    networkPool.markFailure(endpoint);
    networkPool.activeRequests.delete(pendingKey);
    throw lastError || new Error('ALL_RETRIES_FAILED');
  })();
  
  // Store as pending
  networkPool.activeRequests.set(pendingKey, requestPromise);
  
  try {
    return await requestPromise;
  } finally {
    networkPool.activeRequests.delete(pendingKey);
  }
}

/**
 * Safe API call with error details
 * Used by content scripts
 */
async function safeFetchAPI(endpoint, options = {}, maxRetries = 3) {
  try {
    const response = await fetchWithRetry(endpoint, options, maxRetries);
    
    if (!response.ok) {
      return {
        ok: false,
        reason: `http_error_${response.status}`,
        status: response.status
      };
    }
    
    const data = await response.json();
    return { ok: true, data };
    
  } catch (error) {
    // Parse error type
    let reason = 'fetch_failed';
    
    if (error.message.startsWith('TIMEOUT')) {
      reason = 'timeout';
    } else if (error.message.startsWith('AUTH_ERROR')) {
      reason = 'auth_error';
    } else if (error.message.startsWith('HTTP_')) {
      reason = `http_error_${error.message.replace('HTTP_', '')}`;
    } else if (error.message.startsWith('NetworkError')) {
      reason = 'network_error';
    }
    
    return {
      ok: false,
      reason,
      error: error.message,
      details: {
        endpoint,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { fetchWithRetry, safeFetchAPI, networkPool };
}
