import { createContext, useContext } from 'react';

// App-wide actions (open an overlay, etc.) so deep components don't need prop drilling.
export const ActionsContext = createContext({
  open: () => {},
  close: () => {},
});

export const useActions = () => useContext(ActionsContext);
