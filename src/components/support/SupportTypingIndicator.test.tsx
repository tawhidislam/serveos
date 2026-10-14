import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SupportTypingIndicator from './SupportTypingIndicator';
afterEach(cleanup);
describe('support typing indicator', () => {
  it('distinguishes AI from human typing and clears when idle', () => {
    const { rerender } = render(<SupportTypingIndicator ai />);
    expect(screen.getByRole('status')).toHaveTextContent('ServeOS AI is typing…');
    rerender(<SupportTypingIndicator agent />); expect(screen.getByRole('status')).toHaveTextContent('Support team is typing…');
    rerender(<SupportTypingIndicator />); expect(screen.queryByRole('status')).toBeNull();
  });
  it('prioritizes a human agent if both are active', () => {
    render(<SupportTypingIndicator ai agent />); expect(screen.getByRole('status')).toHaveTextContent('Support team is typing…');
  });
});
