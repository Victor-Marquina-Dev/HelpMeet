/**
 * Capa de comunicacion con pywebview API (~200 lineas).
 *
 * Todas las llamadas al backend Python pasan por aqui.
 * Incluye fallback mock para desarrollo sin backend.
 *
 * @module js/api
 */

/** @type {boolean} */
let _mockMode = false;

/**
 * @returns {object} La API de pywebview o un mock para desarrollo.
 */
export function getApi() {
    if (_mockMode || !window.pywebview) {
        return _mockApi();
    }
    return window.pywebview.api;
}

function _mockApi() {
    return {
        get_bootstrap_state: async () => ({ initiatives: [], meetings_by_initiative: {}, version: 'mock' }),
    };
}
