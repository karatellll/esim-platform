import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { letters: string[]; top: number; maxHeight: number; onSelect: (letter: string) => void };

export function CountryAlphabet({ letters, top, maxHeight, onSelect }: Props) {
  if (letters.length === 0) return null;
  const lineHeight = Math.min(16, (maxHeight - letters.length + 1) / letters.length);
  return (
    <View style={[styles.index, { top }]} testID="country-alphabet">
      {letters.map((letter) => (
        <Pressable key={letter} style={[styles.button, { height: lineHeight }]} hitSlop={{ left: 8, right: 2, top: 1, bottom: 1 }} accessibilityRole="button" accessibilityLabel={`К букве ${letter}`} testID={`alphabet-${letter}`} onPress={() => onSelect(letter)}>
          <Text style={[styles.letter, { lineHeight }]}>{letter}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  index: { position: 'absolute', right: 2, width: 13, gap: 1, alignItems: 'center' },
  button: { width: 13, alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#4D5CFF', fontSize: 12, fontWeight: '600', letterSpacing: -0.048, includeFontPadding: false },
});
