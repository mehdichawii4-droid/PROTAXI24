import { Ionicons } from '@expo/vector-icons';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { logBoundaryError } from '@/services/logger';

const gold = '#D4A017';
const green = '#8BC53F';
const bg = '#050505';
const card = '#101010';
const border = '#262626';
const muted = '#8A8A8A';

type Props = {
  children: ReactNode;
  onRestart: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
};

export default class GlobalErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    componentStack: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ componentStack: errorInfo.componentStack ?? null });
    logBoundaryError(error, errorInfo);
  }

  private handleRestart = () => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
    });
    this.props.onRestart();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, componentStack } = this.state;

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.badge}>
            <Ionicons name="warning" size={16} color={gold} />
            <Text style={styles.badgeText}>PROTAXI24</Text>
          </View>

          <Text style={styles.title}>Une erreur est survenue</Text>
          <Text style={styles.subtitle}>
            L&apos;application a rencontré un problème inattendu. Vous pouvez redémarrer
            pour continuer.
          </Text>

          <Pressable style={styles.restartBtn} onPress={this.handleRestart}>
            <Ionicons name="refresh" size={20} color="#111" />
            <Text style={styles.restartText}>Redémarrer</Text>
          </Pressable>

          {__DEV__ && error ? (
            <ScrollView style={styles.debugBox} contentContainerStyle={styles.debugContent}>
              <Text style={styles.debugTitle}>Détails (dev)</Text>
              <Text style={styles.debugMessage}>
                {error.name}: {error.message}
              </Text>
              {error.stack ? (
                <Text style={styles.debugStack}>{error.stack}</Text>
              ) : null}
              {componentStack ? (
                <Text style={styles.debugStack}>{componentStack}</Text>
              ) : null}
            </ScrollView>
          ) : null}

          <View style={styles.footer}>
            <View style={[styles.dot, { backgroundColor: green }]} />
            <Text style={styles.footerText}>Support : réessayez ou reconnectez-vous</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 22,
  },
  badgeText: {
    color: gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 10,
  },
  subtitle: {
    color: muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  restartBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  restartText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
  },
  debugBox: {
    flex: 1,
    marginTop: 20,
    backgroundColor: card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: border,
  },
  debugContent: {
    padding: 14,
    gap: 8,
  },
  debugTitle: {
    color: gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  debugMessage: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  debugStack: {
    color: muted,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footerText: {
    color: muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
