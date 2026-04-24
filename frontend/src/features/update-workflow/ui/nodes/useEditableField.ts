import { useState, useEffect, useRef, useCallback, type ChangeEvent } from "react";
import { useEditableNode } from "./useEditableNode";

export function useEditableField(id: string, field: string, externalValue: string) {
  const { updateField } = useEditableNode(id);
  const [value, setValue] = useState(externalValue);
  const focusedRef = useRef(false);
  const valueRef = useRef(externalValue);

  useEffect(() => {
    if (!focusedRef.current) {
      // external prop changed while not editing — sync local state
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(externalValue);
      valueRef.current = externalValue;
    }
  }, [externalValue]);

  const onFocus = useCallback(() => {
    focusedRef.current = true;
  }, []);

  const onChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    valueRef.current = e.target.value;
  }, []);

  const onBlur = useCallback(() => {
    focusedRef.current = false;
    updateField(field, valueRef.current);
  }, [field, updateField]);

  return { value, setValue, onFocus, onChange, onBlur };
}
