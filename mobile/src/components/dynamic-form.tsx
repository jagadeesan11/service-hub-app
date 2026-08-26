import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { InputTemplateField } from '@/types';

interface DynamicFormProps {
  fields: InputTemplateField[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}

// Renders whatever fields a category's input_template declares (text/number/
// select), so collecting Car Care's vehicle info vs. a future vertical's
// address+room-count needs zero new screens — only new input_templates rows.
export function DynamicForm({ fields, values, onChange }: DynamicFormProps) {
  return (
    <View style={styles.container}>
      {fields.map((field) => (
        <FormField key={field.name} field={field} value={values[field.name] ?? ''} onChange={onChange} />
      ))}
    </View>
  );
}

function FormField({
  field,
  value,
  onChange,
}: {
  field: InputTemplateField;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">
        {field.label}
        {field.required && <ThemedText themeColor="error"> *</ThemedText>}
      </ThemedText>

      {field.type === 'select' ? (
        <View style={styles.chipRow}>
          {(field.options ?? []).map((option) => {
            const isSelected = value === option;
            return (
              <Pressable
                key={option}
                onPress={() => onChange(field.name, option)}
                style={[
                  styles.chip,
                  { borderColor: theme.border },
                  isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
              >
                <ThemedText
                  type="small"
                  themeColor={isSelected ? 'primaryText' : 'text'}
                  style={styles.chipLabel}
                >
                  {option}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={value}
          onChangeText={(text) => onChange(field.name, text)}
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  chipLabel: {
    textTransform: 'capitalize',
  },
});
