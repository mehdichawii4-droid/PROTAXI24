import {
  View,
  StyleSheet,
} from 'react-native';

import colors from '../constants/colors';

type Props = {
  step: number;
};

export default function StepIndicator({
  step,
}: Props) {
  return (
    <View style={styles.container}>
      {[1, 2, 3].map((item) => (
        <View
          key={item}
          style={[
            styles.dot,
            step >= item && styles.active,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 24,
  },

  dot: {
    width: 70,
    height: 4,
    borderRadius: 10,
    backgroundColor: '#333',
  },

  active: {
    backgroundColor: colors.gold,
  },
});