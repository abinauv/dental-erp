// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

// UI component mocks
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

// Mock SignaturePad for FormRenderer tests
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
        data-testid="mock-clear-sig-btn"
        onClick={() => onSignatureChange(null)}
      >
        Clear Sig
      </button>
    </div>
  ),
}))

import { FormRenderer, type FormField } from '@/components/forms/form-renderer'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const textField: FormField = {
  id: 'name',
  type: 'text',
  label: 'Full Name',
  placeholder: 'Enter name',
  required: true,
  validation: { minLength: 2, maxLength: 50 },
}

const textareaField: FormField = {
  id: 'notes',
  type: 'textarea',
  label: 'Notes',
  placeholder: 'Additional notes',
  description: 'Optional notes',
}

const numberField: FormField = {
  id: 'age',
  type: 'number',
  label: 'Age',
  required: true,
  validation: { min: 1, max: 150 },
}

const dateField: FormField = {
  id: 'dob',
  type: 'date',
  label: 'Date of Birth',
  required: true,
}

const selectField: FormField = {
  id: 'gender',
  type: 'select',
  label: 'Gender',
  required: true,
  options: ['Male', 'Female', 'Other'],
  placeholder: 'Select gender',
}

const checkboxField: FormField = {
  id: 'consent',
  type: 'checkbox',
  label: 'I consent to treatment',
  required: true,
  description: 'Please review before checking',
}

const checkboxGroupField: FormField = {
  id: 'symptoms',
  type: 'checkbox',
  label: 'Symptoms',
  options: ['Pain', 'Swelling', 'Bleeding'],
}

const radioField: FormField = {
  id: 'severity',
  type: 'radio',
  label: 'Severity',
  required: true,
  options: ['Mild', 'Moderate', 'Severe'],
}

const headingField: FormField = {
  id: 'section1',
  type: 'heading',
  label: 'Patient Information',
  description: 'Please fill in your details',
}

const paragraphField: FormField = {
  id: 'para1',
  type: 'paragraph',
  label: 'This form is for new patient registration. All fields marked * are mandatory.',
}

const signatureField: FormField = {
  id: 'sig',
  type: 'signature',
  label: 'Patient Signature',
  required: true,
  description: 'I authorize the above treatment',
}

// ---------------------------------------------------------------------------
// FormRenderer Tests
// ---------------------------------------------------------------------------

describe('FormRenderer', () => {
  const mockSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Field rendering', () => {
    it('renders heading fields with label and description', () => {
      render(<FormRenderer fields={[headingField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Patient Information')).toBeInTheDocument()
      expect(screen.getByText('Please fill in your details')).toBeInTheDocument()
    })

    it('renders paragraph fields', () => {
      render(<FormRenderer fields={[paragraphField]} onSubmit={mockSubmit} />)
      expect(screen.getByText(/This form is for new patient registration/)).toBeInTheDocument()
    })

    it('renders text input with placeholder and required indicator', () => {
      render(<FormRenderer fields={[textField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Full Name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('renders textarea with description', () => {
      render(<FormRenderer fields={[textareaField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Notes')).toBeInTheDocument()
      expect(screen.getByText('Optional notes')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Additional notes')).toBeInTheDocument()
    })

    it('renders number input', () => {
      render(<FormRenderer fields={[numberField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Age')).toBeInTheDocument()
    })

    it('renders date input', () => {
      render(<FormRenderer fields={[dateField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Date of Birth')).toBeInTheDocument()
    })

    it('renders select field with options', () => {
      render(<FormRenderer fields={[selectField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Gender')).toBeInTheDocument()
      expect(screen.getByText('Male')).toBeInTheDocument()
      expect(screen.getByText('Female')).toBeInTheDocument()
      expect(screen.getByText('Other')).toBeInTheDocument()
    })

    it('renders single checkbox with description', () => {
      render(<FormRenderer fields={[checkboxField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('I consent to treatment')).toBeInTheDocument()
      expect(screen.getByText('Please review before checking')).toBeInTheDocument()
    })

    it('renders checkbox group with options', () => {
      render(<FormRenderer fields={[checkboxGroupField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Symptoms')).toBeInTheDocument()
      expect(screen.getByText('Pain')).toBeInTheDocument()
      expect(screen.getByText('Swelling')).toBeInTheDocument()
      expect(screen.getByText('Bleeding')).toBeInTheDocument()
    })

    it('renders radio group with options', () => {
      render(<FormRenderer fields={[radioField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Severity')).toBeInTheDocument()
      expect(screen.getByText('Mild')).toBeInTheDocument()
      expect(screen.getByText('Moderate')).toBeInTheDocument()
      expect(screen.getByText('Severe')).toBeInTheDocument()
    })

    it('renders signature field', () => {
      render(<FormRenderer fields={[signatureField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Patient Signature')).toBeInTheDocument()
      expect(screen.getByTestId('signature-pad')).toBeInTheDocument()
    })

    it('renders submit button with custom label', () => {
      render(<FormRenderer fields={[textField]} onSubmit={mockSubmit} submitLabel="Save Form" />)
      expect(screen.getByText('Save Form')).toBeInTheDocument()
    })

    it('renders default submit label', () => {
      render(<FormRenderer fields={[textField]} onSubmit={mockSubmit} />)
      expect(screen.getByText('Submit Form')).toBeInTheDocument()
    })
  })

  describe('Form interaction', () => {
    it('updates text field value on input', async () => {
      render(<FormRenderer fields={[textField]} onSubmit={mockSubmit} />)
      const input = screen.getByPlaceholderText('Enter name')
      fireEvent.change(input, { target: { value: 'John Doe' } })
      expect(input).toHaveValue('John Doe')
    })

    it('updates textarea value on input', async () => {
      render(<FormRenderer fields={[textareaField]} onSubmit={mockSubmit} />)
      const textarea = screen.getByPlaceholderText('Additional notes')
      fireEvent.change(textarea, { target: { value: 'Some notes' } })
      expect(textarea).toHaveValue('Some notes')
    })

    it('submits form data when valid', async () => {
      render(
        <FormRenderer
          fields={[textField]}
          onSubmit={mockSubmit}
          initialData={{ name: 'John Doe' }}
          showSignature={false}
        />
      )
      fireEvent.submit(screen.getByText('Submit Form').closest('form')!)
      expect(mockSubmit).toHaveBeenCalledWith({ name: 'John Doe' }, null)
    })

    it('shows loading spinner when loading', () => {
      render(<FormRenderer fields={[textField]} onSubmit={mockSubmit} loading={true} />)
      const button = screen.getByText('Submit Form').closest('button')
      expect(button).toBeDisabled()
    })
  })

  describe('Validation', () => {
    it('shows required field error on submit', async () => {
      render(<FormRenderer fields={[textField]} onSubmit={mockSubmit} showSignature={false} />)
      fireEvent.submit(screen.getByText('Submit Form').closest('form')!)
      expect(screen.getByText('Full Name is required')).toBeInTheDocument()
      expect(mockSubmit).not.toHaveBeenCalled()
    })

    it('shows minLength error', async () => {
      render(
        <FormRenderer
          fields={[textField]}
          onSubmit={mockSubmit}
          initialData={{ name: 'A' }}
          showSignature={false}
        />
      )
      fireEvent.submit(screen.getByText('Submit Form').closest('form')!)
      expect(screen.getByText('Minimum 2 characters')).toBeInTheDocument()
    })

    it('shows number min validation error', async () => {
      render(
        <FormRenderer
          fields={[numberField]}
          onSubmit={mockSubmit}
          initialData={{ age: '0' }}
          showSignature={false}
        />
      )
      fireEvent.submit(screen.getByText('Submit Form').closest('form')!)
      expect(screen.getByText('Minimum value is 1')).toBeInTheDocument()
    })

    it('shows number max validation error', async () => {
      render(
        <FormRenderer
          fields={[numberField]}
          onSubmit={mockSubmit}
          initialData={{ age: '200' }}
          showSignature={false}
        />
      )
      fireEvent.submit(screen.getByText('Submit Form').closest('form')!)
      expect(screen.getByText('Maximum value is 150')).toBeInTheDocument()
    })

    it('shows signature required error', async () => {
      render(
        <FormRenderer
          fields={[signatureField]}
          onSubmit={mockSubmit}
          showSignature={true}
        />
      )
      fireEvent.submit(screen.getByText('Submit Form').closest('form')!)
      expect(screen.getByText('Signature is required')).toBeInTheDocument()
    })

    it('clears error when value is set', async () => {
      render(<FormRenderer fields={[textField]} onSubmit={mockSubmit} showSignature={false} />)
      // Trigger validation
      fireEvent.submit(screen.getByText('Submit Form').closest('form')!)
      expect(screen.getByText('Full Name is required')).toBeInTheDocument()
      // Type a value — error should clear
      fireEvent.change(screen.getByPlaceholderText('Enter name'), { target: { value: 'John' } })
      expect(screen.queryByText('Full Name is required')).not.toBeInTheDocument()
    })

    it('does not call onSubmit in readOnly mode', () => {
      render(
        <FormRenderer
          fields={[textField]}
          onSubmit={mockSubmit}
          initialData={{ name: 'ReadOnly' }}
          readOnly={true}
        />
      )
      // Submit button should not render in readOnly mode
      expect(screen.queryByText('Submit Form')).not.toBeInTheDocument()
    })
  })

  describe('Read-only mode', () => {
    it('disables text inputs in readOnly mode', () => {
      render(
        <FormRenderer
          fields={[textField]}
          onSubmit={mockSubmit}
          readOnly={true}
          initialData={{ name: 'Readonly Name' }}
        />
      )
      expect(screen.getByDisplayValue('Readonly Name')).toBeDisabled()
    })

    it('shows signature image in readOnly mode', () => {
      render(
        <FormRenderer
          fields={[signatureField]}
          onSubmit={mockSubmit}
          readOnly={true}
          initialSignature="data:image/png;base64,abc"
        />
      )
      const img = screen.getByAltText('Signature')
      expect(img).toHaveAttribute('src', 'data:image/png;base64,abc')
    })

    it('shows "No signature" in readOnly mode when no signature', () => {
      render(
        <FormRenderer
          fields={[signatureField]}
          onSubmit={mockSubmit}
          readOnly={true}
        />
      )
      expect(screen.getByText('No signature')).toBeInTheDocument()
    })
  })

  describe('Initial data', () => {
    it('pre-fills text field with initial data', () => {
      render(
        <FormRenderer
          fields={[textField]}
          onSubmit={mockSubmit}
          initialData={{ name: 'Jane' }}
        />
      )
      expect(screen.getByDisplayValue('Jane')).toBeInTheDocument()
    })

    it('renders all field types without errors', () => {
      const allFields = [
        headingField,
        paragraphField,
        textField,
        textareaField,
        numberField,
        dateField,
        selectField,
        checkboxField,
        checkboxGroupField,
        radioField,
        signatureField,
      ]
      expect(() => {
        render(<FormRenderer fields={allFields} onSubmit={mockSubmit} />)
      }).not.toThrow()
    })
  })
})
