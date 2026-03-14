// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

vi.mock('lucide-react', async (importOriginal) => {
  const icon = (name: string) =>
    React.forwardRef((props: any, ref: any) =>
      React.createElement('svg', { ...props, ref, 'data-testid': `lucide-${name}` })
    )
  const actual = (await importOriginal()) as any
  const handler = { get: (_: any, p: string) => actual[p] || icon(p) }
  return new Proxy(actual, handler)
})

vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef((props: any, ref: any) => <input ref={ref} {...props} />),
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef((props: any, ref: any) => <textarea ref={ref} {...props} />),
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange, disabled, ...rest }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked || false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      data-testid={`checkbox-${id}`}
      {...rest}
    />
  ),
}))

vi.mock('@/components/ui/radio-group', () => ({
  RadioGroup: ({ children, value, onValueChange, disabled }: any) => (
    <div data-testid="radio-group" data-value={value}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange, disabled }) : child
      )}
    </div>
  ),
  RadioGroupItem: ({ value, id, onValueChange, disabled }: any) => (
    <input
      type="radio"
      id={id}
      value={value}
      onChange={() => onValueChange?.(value)}
      disabled={disabled}
      data-testid={`radio-${id}`}
    />
  ),
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <div data-testid="select-root">
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange, disabled }) : child
      )}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
  SelectContent: ({ children, onValueChange }: any) => (
    <div data-testid="select-content">
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? React.cloneElement(child as any, { onValueChange }) : child
      )}
    </div>
  ),
  SelectItem: ({ children, value, onValueChange }: any) => (
    <div data-testid={`select-item-${value}`} onClick={() => onValueChange?.(value)} role="option">
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/forms/signature-pad', () => ({
  SignaturePad: ({ onSignatureChange, label }: any) => (
    <div data-testid="signature-pad">
      <span>{label}</span>
      <button
        data-testid="mock-sign-btn"
        onClick={() => onSignatureChange('data:image/png;base64,fakesig')}
      >
        Sign
      </button>
      <button
        data-testid="mock-clear-btn"
        onClick={() => onSignatureChange(null)}
      >
        Clear
      </button>
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { FormRenderer, FormField } from '@/components/forms/form-renderer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function submitForm() {
  const form = screen.getByText('Submit Form').closest('form')!
  fireEvent.submit(form)
}

// ---------------------------------------------------------------------------
// Tests — Section 2.4: Form Validation
// ---------------------------------------------------------------------------

describe('FormRenderer — Form Validation (Section 2.4)', () => {
  let onSubmit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSubmit = vi.fn()
  })

  // -----------------------------------------------------------------------
  // 1. Required field validation
  // -----------------------------------------------------------------------
  describe('Required field validation', () => {
    it('shows error for empty required text field on submit', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Full Name', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('Full Name is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows error for empty required number field on submit', () => {
      const fields: FormField[] = [
        { id: 'age', type: 'number', label: 'Age', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('Age is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows error for empty required select field on submit', () => {
      const fields: FormField[] = [
        { id: 'gender', type: 'select', label: 'Gender', required: true, options: ['Male', 'Female'] },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('Gender is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows error for empty required date field on submit', () => {
      const fields: FormField[] = [
        { id: 'dob', type: 'date', label: 'Date of Birth', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('Date of Birth is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows error for empty required textarea field on submit', () => {
      const fields: FormField[] = [
        { id: 'notes', type: 'textarea', label: 'Notes', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('Notes is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows error for empty required radio field on submit', () => {
      const fields: FormField[] = [
        { id: 'priority', type: 'radio', label: 'Priority', required: true, options: ['Low', 'High'] },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('Priority is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // 2. MinLength / MaxLength validation
  // -----------------------------------------------------------------------
  describe('MinLength / MaxLength validation', () => {
    it('shows error when text is shorter than minLength', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name', validation: { minLength: 3 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ab' } })
      submitForm()
      expect(screen.getByText('Minimum 3 characters')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('does not show minLength error when text meets minimum', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name', validation: { minLength: 3 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } })
      submitForm()
      expect(screen.queryByText('Minimum 3 characters')).not.toBeInTheDocument()
      expect(onSubmit).toHaveBeenCalled()
    })

    it('shows error when text exceeds maxLength', () => {
      const fields: FormField[] = [
        { id: 'code', type: 'text', label: 'Code', validation: { maxLength: 10 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      // The Input component gets maxLength passed as an HTML attribute, but the
      // validation logic also checks via validate(). We simulate a value that
      // exceeds maxLength by directly setting formData through onChange.
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '12345678901' } })
      submitForm()
      expect(screen.getByText('Maximum 10 characters')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('does not show maxLength error when text is within limit', () => {
      const fields: FormField[] = [
        { id: 'code', type: 'text', label: 'Code', validation: { maxLength: 10 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '1234567890' } })
      submitForm()
      expect(screen.queryByText('Maximum 10 characters')).not.toBeInTheDocument()
      expect(onSubmit).toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // 3. Number validation (min / max)
  // -----------------------------------------------------------------------
  describe('Number min / max validation', () => {
    it('shows error when number is below min', () => {
      const fields: FormField[] = [
        { id: 'qty', type: 'number', label: 'Quantity', validation: { min: 0 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-1' } })
      submitForm()
      expect(screen.getByText('Minimum value is 0')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('accepts number equal to min', () => {
      const fields: FormField[] = [
        { id: 'qty', type: 'number', label: 'Quantity', validation: { min: 0 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '0' } })
      submitForm()
      expect(screen.queryByText(/minimum value/i)).not.toBeInTheDocument()
      expect(onSubmit).toHaveBeenCalled()
    })

    it('shows error when number exceeds max', () => {
      const fields: FormField[] = [
        { id: 'score', type: 'number', label: 'Score', validation: { max: 100 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '101' } })
      submitForm()
      expect(screen.getByText('Maximum value is 100')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('accepts number equal to max', () => {
      const fields: FormField[] = [
        { id: 'score', type: 'number', label: 'Score', validation: { max: 100 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } })
      submitForm()
      expect(screen.queryByText(/maximum value/i)).not.toBeInTheDocument()
      expect(onSubmit).toHaveBeenCalled()
    })

    it('validates both min and max together', () => {
      const fields: FormField[] = [
        { id: 'pct', type: 'number', label: 'Percentage', validation: { min: 0, max: 100 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '150' } })
      submitForm()
      expect(screen.getByText('Maximum value is 100')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })
  })

  // -----------------------------------------------------------------------
  // 4. Signature required validation
  // -----------------------------------------------------------------------
  describe('Signature required validation', () => {
    it('shows error when signature field is required but not signed', () => {
      const fields: FormField[] = [
        { id: 'sig', type: 'signature', label: 'Patient Signature', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={true} />)
      submitForm()
      expect(screen.getByText('Signature is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('clears signature error after signing', () => {
      // Signature validation is handled separately via _signature key,
      // not via the field's required attribute
      const fields: FormField[] = [
        { id: 'sig', type: 'signature', label: 'Patient Signature' },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={true} />)
      submitForm()
      expect(screen.getByText('Signature is required')).toBeInTheDocument()

      // Sign via mock button
      fireEvent.click(screen.getByTestId('mock-sign-btn'))
      submitForm()
      expect(screen.queryByText('Signature is required')).not.toBeInTheDocument()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('does not require signature when showSignature is false', () => {
      const fields: FormField[] = [
        { id: 'sig', type: 'signature', label: 'Signature', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      // showSignature=false bypasses the signature check
      expect(screen.queryByText('Signature is required')).not.toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 5. Multiple field validation
  // -----------------------------------------------------------------------
  describe('Multiple field validation', () => {
    const multiFields: FormField[] = [
      { id: 'first', type: 'text', label: 'First Name', required: true },
      { id: 'last', type: 'text', label: 'Last Name', required: true },
      { id: 'age', type: 'number', label: 'Age', required: true },
    ]

    it('shows errors for all empty required fields on submit', () => {
      render(<FormRenderer fields={multiFields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('First Name is required')).toBeInTheDocument()
      expect(screen.getByText('Last Name is required')).toBeInTheDocument()
      expect(screen.getByText('Age is required')).toBeInTheDocument()
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('clears error for fixed field while others remain', () => {
      render(<FormRenderer fields={multiFields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('First Name is required')).toBeInTheDocument()
      expect(screen.getByText('Last Name is required')).toBeInTheDocument()

      // Fix the first field — the setValue function clears that field's error
      const inputs = screen.getAllByRole('textbox')
      fireEvent.change(inputs[0], { target: { value: 'John' } })

      // The first name error should be cleared by setValue
      expect(screen.queryByText('First Name is required')).not.toBeInTheDocument()
      // Last name error should remain
      expect(screen.getByText('Last Name is required')).toBeInTheDocument()
    })

    it('does not submit until all errors are fixed', () => {
      render(<FormRenderer fields={multiFields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(onSubmit).not.toHaveBeenCalled()

      // Fix first two fields
      const inputs = screen.getAllByRole('textbox')
      fireEvent.change(inputs[0], { target: { value: 'John' } })
      fireEvent.change(inputs[1], { target: { value: 'Doe' } })
      submitForm()
      // Age still empty
      expect(onSubmit).not.toHaveBeenCalled()

      // Fix age
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '30' } })
      submitForm()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------------------------------------
  // 6. Valid form submission
  // -----------------------------------------------------------------------
  describe('Valid form submission', () => {
    it('calls onSubmit with form data when all required fields are filled', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name', required: true },
        { id: 'email', type: 'text', label: 'Email', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      const inputs = screen.getAllByRole('textbox')
      fireEvent.change(inputs[0], { target: { value: 'John' } })
      fireEvent.change(inputs[1], { target: { value: 'john@test.com' } })
      submitForm()
      expect(onSubmit).toHaveBeenCalledWith(
        { name: 'John', email: 'john@test.com' },
        null
      )
    })

    it('submits successfully when optional fields are left empty', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name', required: true },
        { id: 'notes', type: 'textarea', label: 'Notes' },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      // Use getAllByRole since both input and textarea have textbox role
      const inputs = screen.getAllByRole('textbox')
      fireEvent.change(inputs[0], { target: { value: 'Jane' } })
      submitForm()
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Jane' }, null)
    })

    it('includes signature data when form has signature field', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name', required: true },
        { id: 'sig', type: 'signature', label: 'Signature' },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={true} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Jane' } })
      fireEvent.click(screen.getByTestId('mock-sign-btn'))
      submitForm()
      expect(onSubmit).toHaveBeenCalledWith(
        { name: 'Jane' },
        'data:image/png;base64,fakesig'
      )
    })

    it('passes initialData values to onSubmit if not changed', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name', required: true },
      ]
      render(
        <FormRenderer
          fields={fields}
          onSubmit={onSubmit}
          showSignature={false}
          initialData={{ name: 'Prefilled' }}
        />
      )
      submitForm()
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Prefilled' }, null)
    })

    it('does not validate heading and paragraph fields', () => {
      const fields: FormField[] = [
        { id: 'h1', type: 'heading', label: 'Section Title' },
        { id: 'p1', type: 'paragraph', label: 'Some instructions here.' },
        { id: 'name', type: 'text', label: 'Name', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Test' } })
      submitForm()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })

  // -----------------------------------------------------------------------
  // 7. ReadOnly mode
  // -----------------------------------------------------------------------
  describe('ReadOnly mode', () => {
    it('does not render a submit button in readOnly mode', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name' },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} readOnly={true} showSignature={false} />)
      expect(screen.queryByRole('button', { name: /submit form/i })).not.toBeInTheDocument()
    })

    it('renders text inputs as disabled in readOnly mode', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name' },
      ]
      render(
        <FormRenderer
          fields={fields}
          onSubmit={onSubmit}
          readOnly={true}
          showSignature={false}
          initialData={{ name: 'ReadOnly Value' }}
        />
      )
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('renders number inputs as disabled in readOnly mode', () => {
      const fields: FormField[] = [
        { id: 'age', type: 'number', label: 'Age' },
      ]
      render(
        <FormRenderer fields={fields} onSubmit={onSubmit} readOnly={true} showSignature={false} />
      )
      expect(screen.getByRole('spinbutton')).toBeDisabled()
    })

    it('renders date inputs as disabled in readOnly mode', () => {
      const fields: FormField[] = [
        { id: 'dob', type: 'date', label: 'DOB' },
      ]
      render(
        <FormRenderer fields={fields} onSubmit={onSubmit} readOnly={true} showSignature={false} />
      )
      // date input has no specific role, find by id
      const dateInput = document.getElementById('dob') as HTMLInputElement
      expect(dateInput).toBeDisabled()
    })

    it('renders textarea as disabled in readOnly mode', () => {
      const fields: FormField[] = [
        { id: 'notes', type: 'textarea', label: 'Notes' },
      ]
      render(
        <FormRenderer fields={fields} onSubmit={onSubmit} readOnly={true} showSignature={false} />
      )
      expect(screen.getByRole('textbox')).toBeDisabled()
    })

    it('does not call onSubmit even if form submission is forced in readOnly mode', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name' },
      ]
      render(
        <FormRenderer fields={fields} onSubmit={onSubmit} readOnly={true} showSignature={false} />
      )
      // Directly submit the form element
      const form = document.querySelector('form')!
      fireEvent.submit(form)
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('shows signature image in readOnly mode when signature exists', () => {
      const fields: FormField[] = [
        { id: 'sig', type: 'signature', label: 'Signature' },
      ]
      render(
        <FormRenderer
          fields={fields}
          onSubmit={onSubmit}
          readOnly={true}
          showSignature={true}
          initialSignature="data:image/png;base64,readsig"
        />
      )
      const img = screen.getByAltText('Signature') as HTMLImageElement
      expect(img.src).toContain('readsig')
    })
  })

  // -----------------------------------------------------------------------
  // 8. Error clearing on value change
  // -----------------------------------------------------------------------
  describe('Error clearing on value change', () => {
    it('clears error for a text field when user types a value', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('Name is required')).toBeInTheDocument()

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'J' } })
      expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
    })

    it('clears error for a number field when user enters a value', () => {
      const fields: FormField[] = [
        { id: 'age', type: 'number', label: 'Age', required: true },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      submitForm()
      expect(screen.getByText('Age is required')).toBeInTheDocument()

      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } })
      expect(screen.queryByText('Age is required')).not.toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 9. Loading state
  // -----------------------------------------------------------------------
  describe('Loading state', () => {
    it('disables submit button when loading is true', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name' },
      ]
      render(
        <FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} loading={true} />
      )
      expect(screen.getByRole('button', { name: /submit form/i })).toBeDisabled()
    })

    it('shows custom submit label', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name' },
      ]
      render(
        <FormRenderer
          fields={fields}
          onSubmit={onSubmit}
          showSignature={false}
          submitLabel="Save Changes"
        />
      )
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    })
  })

  // -----------------------------------------------------------------------
  // 10. Combined validation scenarios
  // -----------------------------------------------------------------------
  describe('Combined validation scenarios', () => {
    it('validates required AND minLength together', () => {
      const fields: FormField[] = [
        { id: 'name', type: 'text', label: 'Name', required: true, validation: { minLength: 3 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      // Empty — should show required error (required check runs first with continue)
      submitForm()
      expect(screen.getByText('Name is required')).toBeInTheDocument()

      // Enter short value — should show minLength error
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ab' } })
      submitForm()
      expect(screen.getByText('Minimum 3 characters')).toBeInTheDocument()

      // Enter valid value — should submit
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } })
      submitForm()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })

    it('validates required number field with min/max constraints', () => {
      const fields: FormField[] = [
        { id: 'score', type: 'number', label: 'Score', required: true, validation: { min: 0, max: 100 } },
      ]
      render(<FormRenderer fields={fields} onSubmit={onSubmit} showSignature={false} />)
      // Empty — required error
      submitForm()
      expect(screen.getByText('Score is required')).toBeInTheDocument()

      // Below min
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-5' } })
      submitForm()
      expect(screen.getByText('Minimum value is 0')).toBeInTheDocument()

      // Above max
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '200' } })
      submitForm()
      expect(screen.getByText('Maximum value is 100')).toBeInTheDocument()

      // Valid
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '50' } })
      submitForm()
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
  })
})
