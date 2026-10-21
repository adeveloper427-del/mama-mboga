/**
 * Connectivity flag shared between the NetworkProvider (which listens to the
 * device) and the service layer (which refuses requests while offline, exactly
 * like a real HTTP client would fail).
 */
let online = true;

export const network = {
  isOnline: () => online,
  setOnline: (value: boolean) => {
    online = value;
  },
};
