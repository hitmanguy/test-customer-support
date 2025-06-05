'use client';

import { useState, useCallback, useMemo } from 'react';

interface FormField<T> {
  value: T;
  error: string | null;
  touched: boolean;
}

type FormValues<T> = {
  [K in keyof T]: FormField<T[K]>;
};

type ValidationRules<T> = {
  [K in keyof T]?: (value: T[K], formValues: T) => string | null;
};

interface UseFormProps<T> {
  initialValues: T;
  validationRules?: ValidationRules<T>;
  onSubmit: (values: T) => void | Promise<void>;
}


export default function useForm<T extends Record<string, any>>({
  initialValues,
  validationRules = {},
  onSubmit,
}: UseFormProps<T>) {
  
  const [formState, setFormState] = useState<FormValues<T>>(() => {
    const initialState: Partial<FormValues<T>> = {};
    
    
    Object.keys(initialValues).forEach((key) => {
      const fieldKey = key as keyof T;
      initialState[fieldKey] = {
        value: initialValues[fieldKey],
        error: null,
        touched: false,
      };
    });
    
    return initialState as FormValues<T>;
  });

  
  const values = useMemo(() => {
    const valuesOnly: Partial<T> = {};
    
    Object.keys(formState).forEach((key) => {
      const fieldKey = key as keyof T;
      valuesOnly[fieldKey] = formState[fieldKey].value;
    });
    
    return valuesOnly as T;
  }, [formState]);

  
  const errors = useMemo(() => {
    const errorsOnly: Partial<Record<keyof T, string | null>> = {};
    
    Object.keys(formState).forEach((key) => {
      const fieldKey = key as keyof T;
      errorsOnly[fieldKey] = formState[fieldKey].error;
    });
    
    return errorsOnly;
  }, [formState]);

  
  const isValid = useMemo(() => {
    return Object.values(errors).every((error) => error === null);
  }, [errors]);

  
  const validateField = useCallback(
    (name: keyof T, value: any): string | null => {
      const validationRule = validationRules[name];
      if (!validationRule) return null;
      return validationRule(value, values);
    },
    [validationRules, values]
  );

  
  const handleChange = useCallback(
    (name: keyof T, value: any) => {
      setFormState((prev) => ({
        ...prev,
        [name]: {
          value,
          touched: true,
          error: validateField(name, value),
        },
      }));
    },
    [validateField]
  );

  
  const handleBlur = useCallback(
    (name: keyof T) => {
      setFormState((prev) => {
        
        if (prev[name].touched) return prev;
        
        return {
          ...prev,
          [name]: {
            ...prev[name],
            touched: true,
            error: validateField(name, prev[name].value),
          },
        };
      });
    },
    [validateField]
  );

  
  const resetForm = useCallback(() => {
    const initialState: Partial<FormValues<T>> = {};
    
    Object.keys(initialValues).forEach((key) => {
      const fieldKey = key as keyof T;
      initialState[fieldKey] = {
        value: initialValues[fieldKey],
        error: null,
        touched: false,
      };
    });
    
    setFormState(initialState as FormValues<T>);
  }, [initialValues]);

  
  const validateForm = useCallback((): boolean => {
    let isFormValid = true;
    const newFormState = { ...formState };
    
    Object.keys(formState).forEach((key) => {
      const fieldKey = key as keyof T;
      const error = validateField(fieldKey, formState[fieldKey].value);
      
      if (error) {
        isFormValid = false;
      }
      
      newFormState[fieldKey] = {
        ...newFormState[fieldKey],
        error,
        touched: true,
      };
    });
    
    setFormState(newFormState);
    return isFormValid;
  }, [formState, validateField]);

  
  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      
      if (validateForm()) {
        await onSubmit(values);
      }
    },
    [validateForm, values, onSubmit]
  );

  
  return {
    values,
    errors,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    validateForm,
    formState,
  };
}
