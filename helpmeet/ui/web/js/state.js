/**
 * Estado central de la aplicacion (~100 lineas).
 *
 * Objeto STATE con todos los datos de la UI. Un solo lugar
 * para leer y escribir el estado, sin variables globales sueltas.
 *
 * @module js/state
 */

/** @type {object} */
export const STATE = {
    /** @type {Array} */
    initiatives: [],
    /** @type {object} */
    meetingsByInitiative: {},
    /** @type {string} */
    currentScreen: 'welcome',
    /** @type {number|null} */
    activeInitiativeId: null,
    /** @type {number|null} */
    activeMeetingId: null,
};
