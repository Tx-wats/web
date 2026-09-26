import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import RuleBuilder from '../components/RuleBuilder';

describe('RuleBuilder editing index integrity', () => {
  it('keeps editing the correct rule after removing an earlier rule', () => {
    render(<RuleBuilder />);

    // Add three rules so we have indices 0, 1, 2.
    const addButton = screen.getByRole('button', { name: /add rule/i });
    fireEvent.click(addButton);
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const ruleItems = () => screen.getAllByTestId('rule-item');
    expect(ruleItems()).toHaveLength(3);

    // Give each rule a distinguishable name.
    const nameInputs = () => screen.getAllByLabelText(/rule name/i);
    fireEvent.change(nameInputs()[0], { target: { value: 'Rule Zero' } });
    fireEvent.change(nameInputs()[1], { target: { value: 'Rule One' } });
    fireEvent.change(nameInputs()[2], { target: { value: 'Rule Two' } });

    // Start editing rule #2.
    const editButtons = screen.getAllByRole('button', { name: /edit rule/i });
    fireEvent.click(editButtons[2]);

    // While editing rule #2, remove rule #0.
    const removeButtons = screen.getAllByRole('button', { name: /remove rule/i });
    fireEvent.click(removeButtons[0]);

    // Rule #0 is gone; the remaining rules are Rule One and Rule Two.
    expect(ruleItems()).toHaveLength(2);
    expect(nameInputs()[0]).toHaveValue('Rule One');
    expect(nameInputs()[1]).toHaveValue('Rule Two');

    // Update the rule currently being edited.
    const updateButton = screen.getByRole('button', { name: /update rule/i });
    fireEvent.change(nameInputs()[1], { target: { value: 'Rule Two Updated' } });
    fireEvent.click(updateButton);

    // The update must target the rule that was being edited (Rule Two),
    // not the wrong rule or an out-of-range index.
    const updatedInputs = nameInputs();
    expect(updatedInputs).toHaveLength(2);
    expect(updatedInputs[0]).toHaveValue('Rule One');
    expect(updatedInputs[1]).toHaveValue('Rule Two Updated');
  });

  it('resets editing state when the rule being edited is removed', () => {
    render(<RuleBuilder />);

    const addButton = screen.getByRole('button', { name: /add rule/i });
    fireEvent.click(addButton);
    fireEvent.click(addButton);

    const nameInputs = () => screen.getAllByLabelText(/rule name/i);
    fireEvent.change(nameInputs()[0], { target: { value: 'First' } });
    fireEvent.change(nameInputs()[1], { target: { value: 'Second' } });

    // Edit rule #1, then remove it.
    const editButtons = screen.getAllByRole('button', { name: /edit rule/i });
    fireEvent.click(editButtons[1]);

    const removeButtons = screen.getAllByRole('button', { name: /remove rule/i });
    fireEvent.click(removeButtons[1]);

    // Editing state should be cleared: no stale "Update Rule" button remains.
    expect(screen.queryByRole('button', { name: /update rule/i })).not.toBeInTheDocument();
    expect(screen.getAllByTestId('rule-item')).toHaveLength(1);
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
