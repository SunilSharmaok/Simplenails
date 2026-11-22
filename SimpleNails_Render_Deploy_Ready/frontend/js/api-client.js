/* The production frontend and API share the same Render origin.
   Keep VS Code Live Server on localhost:5500 working for local development. */
const simpleNailsLocalLiveServer = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port === '5500';
window.API_BASE_URL = window.API_BASE_URL || (simpleNailsLocalLiveServer ? 'http://localhost:5000/api' : `${window.location.origin}/api`);

window.apiRequest = async function (path, options = {}) {
    const user = window.firebase?.auth?.().currentUser;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
    let response;
    try {
        response = await fetch(`${window.API_BASE_URL}${path}`, {
            method: options.method || 'GET',
            headers,
            body: options.body === undefined ? undefined : JSON.stringify(options.body)
        });
    } catch (error) {
        throw new Error('Cannot reach the SimpleNails server. Check your connection and try again. If it is hosted on Render, the service may be starting up.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
};
