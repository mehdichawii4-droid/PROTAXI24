import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatRideMessageTime,
  isRideChatOpen,
  markRideMessagesRead,
  RideChatError,
  sendRideMessage,
  subscribeRideMessages,
  type RideMessage,
  type RideMessageSenderRole,
} from '@/services/rideChat';
import { devError, devLog } from '@/utils/devLog';

const gold = '#D4A017';
const green = '#2ECC71';
const bg = '#050505';
const card = '#0E0E0E';
const border = '#262626';
const muted = '#8A8A8A';

type RideChatSheetProps = {
  visible: boolean;
  onClose: () => void;
  rideId: string;
  senderId: string;
  senderRole: RideMessageSenderRole;
  rideStatus: string;
  peerLabel?: string;
};

export default function RideChatSheet({
  visible,
  onClose,
  rideId,
  senderId,
  senderRole,
  rideStatus,
  peerLabel = 'Course PROTAXI',
}: RideChatSheetProps) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<RideMessage>>(null);
  const markedReadSessionRef = useRef(false);
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const chatOpen = isRideChatOpen(rideStatus);
  const canSend = chatOpen && draft.trim().length > 0 && !isSending;

  useEffect(() => {
    if (!visible || !rideId.trim()) {
      return undefined;
    }

    devLog('[RIDE CHAT] subscribe start', { rideId, senderRole, senderId });
    const unsubscribe = subscribeRideMessages(
      rideId,
      (nextMessages) => {
        devLog('[RIDE CHAT] messages count', {
          rideId,
          senderRole,
          count: nextMessages.length,
        });
        setMessages(nextMessages);
      },
      (error) => {
        devError('[RIDE CHAT] subscribe error', { rideId, senderRole, error });
      },
    );
    return unsubscribe;
  }, [visible, rideId, senderRole, senderId]);

  useEffect(() => {
    if (!visible) {
      markedReadSessionRef.current = false;
      return;
    }

    if (!rideId.trim() || !senderId.trim() || markedReadSessionRef.current) {
      return;
    }

    markedReadSessionRef.current = true;
    void markRideMessagesRead(rideId, {
      readerId: senderId,
      readerRole: senderRole,
    }).catch((error) => {
      devError('[RIDE CHAT UI] markRideMessagesRead failed', error);
      markedReadSessionRef.current = false;
    });
  }, [visible, rideId, senderId, senderRole]);

  useEffect(() => {
    if (!visible || messages.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 80);

    return () => clearTimeout(timer);
  }, [visible, messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending || !chatOpen) {
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      await sendRideMessage(rideId, {
        senderId,
        senderRole,
        text,
      });
      setDraft('');
    } catch (error) {
      const message =
        error instanceof RideChatError
          ? error.message
          : 'Impossible d\'envoyer le message.';
      setSendError(message);
      devError('[RIDE CHAT UI] send failed', error);
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: RideMessage }) => {
    const isOwn = item.senderRole === senderRole;

    return (
      <View
        style={[
          styles.messageRow,
          isOwn ? styles.messageRowOwn : styles.messageRowPeer,
        ]}
      >
        <View
          style={[
            styles.bubble,
            isOwn ? styles.bubbleOwn : styles.bubblePeer,
          ]}
        >
          {!isOwn ? (
            <Text style={styles.senderBadge}>
              {item.senderRole === 'driver' ? 'CHAUFFEUR' : 'CLIENT'}
            </Text>
          ) : null}
          <Text style={[styles.messageText, isOwn && styles.messageTextOwn]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTime, isOwn && styles.messageTimeOwn]}>
            {formatRideMessageTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <KeyboardAvoidingView
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>CHAT LIVE</Text>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {peerLabel}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>

          {!chatOpen ? (
            <View style={styles.closedBanner}>
              <Text style={styles.closedBannerText}>
                Le chat est fermé pour ce statut de course.
              </Text>
            </View>
          ) : null}

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                Aucun message. Écrivez pour coordonner la prise en charge.
              </Text>
            }
          />

          {sendError ? (
            <Text style={styles.errorText}>{sendError}</Text>
          ) : null}

          <View style={styles.composerRow}>
            <TextInput
              style={styles.input}
              placeholder={chatOpen ? 'Votre message…' : 'Chat fermé'}
              placeholderTextColor={muted}
              value={draft}
              onChangeText={setDraft}
              editable={chatOpen && !isSending}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={() => void handleSend()}
              disabled={!canSend}
              activeOpacity={0.85}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#111" />
              ) : (
                <Ionicons name="send" size={18} color="#111" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    maxHeight: '82%',
    minHeight: '52%',
    backgroundColor: bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: border,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#333',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: green,
  },
  liveText: {
    color: green,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(212,160,23,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,160,23,0.35)',
  },
  closedBannerText: {
    color: gold,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexGrow: 1,
  },
  emptyText: {
    color: muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  messageRow: {
    marginBottom: 10,
    maxWidth: '88%',
  },
  messageRowOwn: {
    alignSelf: 'flex-end',
  },
  messageRowPeer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleOwn: {
    backgroundColor: 'rgba(46,204,113,0.18)',
    borderColor: 'rgba(46,204,113,0.45)',
  },
  bubblePeer: {
    backgroundColor: card,
    borderColor: border,
  },
  senderBadge: {
    color: gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  messageText: {
    color: '#F2F2F2',
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextOwn: {
    color: '#FFF',
  },
  messageTime: {
    color: muted,
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  messageTimeOwn: {
    alignSelf: 'flex-end',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    backgroundColor: card,
    borderWidth: 1,
    borderColor: border,
    color: '#FFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
});
