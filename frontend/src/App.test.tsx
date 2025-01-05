import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App, { NameContext } from './App';
import { test, expect } from 'vitest';

test('navigates to analysisPanel on link click', () => {
  render(
    <NameContext.Provider value={{ jobID: '123', setId: () => {} }}>
      <App />
    </NameContext.Provider>
  );

  const linkElement = screen.getByText(/Run/i);
  fireEvent.click(linkElement);
});
