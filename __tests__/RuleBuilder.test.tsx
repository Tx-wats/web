import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RuleBuilder from '../components/RuleBuilder';

describe('RuleBuilder addRule immutability', () => {
  it('does not mutate the previous draft object when adding a rule', () => {
    render(<RuleBuilder />);

    const input = screen.getByPlaceholderText(/function name/i);
    fireEvent.change(input, { target: { value: 'zeta' } });
    fireEvent.click(screen.getByRole('button', { name: /add rule/i }));

    const previousDraft = screen.getByTestId('previous-draft');
    const previousNames = JSON.parse(previousDraft.textContent || '[]');

    expect(previousNames).toEqual([]);
  });
});
