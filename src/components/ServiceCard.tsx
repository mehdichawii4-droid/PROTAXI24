import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

type Props = {
  icon: any;
  title: string;
  description: string;
  onPress?: () => void;
};

export default function ServiceCard({
  icon,
  title,
  description,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={28}
          color="#D4A017"
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          {title}
        </Text>

        <Text style={styles.description}>
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={28}
        color="#D4A017"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(15,15,15,0.72)',
    borderRadius: 28,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,

    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  iconContainer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0D0D0D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 18,
  },

  content: {
    flex: 1,
  },

  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },

  description: {
    color: 'rgba(255,255,255,0.75)',
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
  },
});