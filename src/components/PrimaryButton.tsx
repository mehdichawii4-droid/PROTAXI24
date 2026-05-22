import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';

import colors from '../constants/colors';

type Props = {
  title: string;
  onPress?: () => void;
};

export default function PrimaryButton({
  title,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.text}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 58,
    backgroundColor: colors.gold,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  text: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
});