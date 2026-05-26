import { StyleSheet, Text, View, ViewStyle } from 'react-native';

type WebMapPlaceholderProps = {
  style?: ViewStyle;
};

export default function WebMapPlaceholder({ style }: WebMapPlaceholderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>Carte indisponible sur Web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  text: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
});
