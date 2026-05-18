import { render, screen } from '@testing-library/react';
import App from './App';

test('renders CM title', () => {
  render(<App />);
  const title = screen.getByText(/CM 대가산출 시스템/i);
  expect(title).toBeInTheDocument();
});
