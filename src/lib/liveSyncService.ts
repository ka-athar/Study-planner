/**
 * Real-Time Cross-Device Live Synchronization Service
 * 
 * Provides instantaneous sub-second multi-device synchronization using:
 * 1. Server-Sent Events (SSE) stream (/api/sync/events) for remote cross-device propagation.
 * 2. BroadcastChannel & Storage Event fallback for zero-latency same-machine tab synchronization.
 * 3. Heartbeat presence tracking with live peer device count awareness.
 */

import { getOrCreateDeviceId, detectDeviceInfo } from './deviceService';
import { getActiveUserEmail } from './db';
import { broadcastSyncMessage, subscribeToSyncBroadcast } from './syncChannel';

export interface LivePeerDevice {
  deviceId: string;
  deviceName: string;
  deviceType?: string;
  connectedAt: number;
}

export interface LiveMutationEvent {
  sourceDeviceId: string;
  sourceDeviceName: string;
  collection: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'FULL_SNAPSHOT';
  docId?: string;
  payload: any;
  timestamp: string;
  peerCount?: number;
}

export type MutationListener = (event: LiveMutationEvent) => void;
export type PeersListener = (peers: LivePeerDevice[], peerCount: number) => void;
export type LiveConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
export type ConnectionStateListener = (state: LiveConnectionState) => void;

class LiveSyncService {
  private eventSource: EventSource | null = null;
  private currentUid: string = '';
  private currentEmail: string = '';
  private activePeers: LivePeerDevice[] = [];
  private connectionState: LiveConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private isDestroyed = false;

  private mutationListeners = new Set<MutationListener>();
  private peersListeners = new Set<PeersListener>();
  private stateListeners = new Set<ConnectionStateListener>();

  constructor() {
    // Listen to local same-browser broadcast events
    if (typeof window !== 'undefined') {
      subscribeToSyncBroadcast((msg) => {
        if (msg.type === 'SYNC_RESTORE_PAYLOAD' || msg.type === 'FORCE_PULL_COMPLETED') {
          if (msg.payload && msg.sourceDeviceId !== getOrCreateDeviceId()) {
            this.notifyMutationListeners({
              sourceDeviceId: msg.sourceDeviceId,
              sourceDeviceName: msg.sourceDeviceName,
              collection: 'ALL',
              action: 'FULL_SNAPSHOT',
              payload: msg.payload,
              timestamp: msg.timestamp
            });
          }
        }
      });
    }
  }

  public init(uid: string, email?: string) {
    if (this.currentUid === uid && this.currentEmail === (email || '') && this.eventSource) {
      return;
    }

    this.currentUid = uid;
    this.currentEmail = email || getActiveUserEmail() || '';
    this.isDestroyed = false;
    this.reconnectAttempts = 0;
    this.connect();
  }

  public updateIdentity(uid: string, email?: string) {
    this.init(uid, email);
  }

  private setConnectionState(state: LiveConnectionState) {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.stateListeners.forEach(fn => {
        try { fn(state); } catch (e) {}
      });
    }
  }

  private connect() {
    if (typeof window === 'undefined' || this.isDestroyed) return;
    if (!this.currentUid && !this.currentEmail) return;

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (e) {}
      this.eventSource = null;
    }

    this.setConnectionState('connecting');

    const devInfo = detectDeviceInfo();
    const deviceId = getOrCreateDeviceId();
    const params = new URLSearchParams({
      uid: this.currentUid,
      email: this.currentEmail,
      deviceId,
      deviceName: devInfo.deviceName,
      deviceType: devInfo.deviceType
    });

    try {
      const url = `/api/sync/events?${params.toString()}`;
      const es = new EventSource(url);
      this.eventSource = es;

      es.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
      };

      es.addEventListener('handshake', (evt: any) => {
        try {
          const data = JSON.parse(evt.data);
          if (Array.isArray(data.activePeers)) {
            this.updatePeers(data.activePeers);
          }
        } catch (e) {}
      });

      es.addEventListener('mutation', (evt: any) => {
        try {
          const mutation = JSON.parse(evt.data) as LiveMutationEvent;
          if (mutation.sourceDeviceId !== deviceId) {
            this.notifyMutationListeners(mutation);
          }
        } catch (e) {}
      });

      es.addEventListener('peer_joined', (evt: any) => {
        try {
          const data = JSON.parse(evt.data);
          if (Array.isArray(data.activePeers)) {
            this.updatePeers(data.activePeers);
          }
        } catch (e) {}
      });

      es.addEventListener('peer_left', (evt: any) => {
        try {
          const data = JSON.parse(evt.data);
          if (Array.isArray(data.activePeers)) {
            this.updatePeers(data.activePeers);
          }
        } catch (e) {}
      });

      es.onerror = () => {
        es.close();
        this.eventSource = null;
        this.setConnectionState('disconnected');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('LiveSync EventSource initialization note:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.isDestroyed || this.reconnectTimer) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.setConnectionState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private updatePeers(peers: LivePeerDevice[]) {
    this.activePeers = peers;
    const count = peers.length;
    this.peersListeners.forEach(fn => {
      try { fn(peers, count); } catch (e) {}
    });
  }

  private notifyMutationListeners(mutation: LiveMutationEvent) {
    this.mutationListeners.forEach(fn => {
      try { fn(mutation); } catch (e) {
        console.error('Error in live mutation listener:', e);
      }
    });
  }

  /**
   * Broadcast a mutation from this device to all other connected devices
   */
  public async broadcastMutation(params: {
    collection: string;
    action?: 'INSERT' | 'UPDATE' | 'DELETE' | 'FULL_SNAPSHOT';
    docId?: string;
    payload: any;
  }): Promise<boolean> {
    const devInfo = detectDeviceInfo();
    const sourceDeviceId = getOrCreateDeviceId();
    const action = params.action || 'UPDATE';
    const timestamp = new Date().toISOString();

    // 1. Broadcast locally to same-browser tabs instantly
    broadcastSyncMessage({
      type: 'SYNC_RESTORE_PAYLOAD',
      sourceDeviceId,
      sourceDeviceName: devInfo.deviceName,
      payload: params.collection === 'ALL' || params.action === 'FULL_SNAPSHOT' 
        ? params.payload 
        : { [params.collection]: params.payload },
      email: this.currentEmail,
      uid: this.currentUid
    });

    // 2. Broadcast remotely across network via Server API
    try {
      const res = await fetch('/api/sync/notify-mutation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: this.currentUid,
          email: this.currentEmail,
          sourceDeviceId,
          sourceDeviceName: devInfo.deviceName,
          collection: params.collection,
          action,
          docId: params.docId,
          payload: params.payload,
          timestamp
        })
      });
      return res.ok;
    } catch (e) {
      console.warn('Network broadcast mutation note:', e);
      return false;
    }
  }

  public onMutation(callback: MutationListener): () => void {
    this.mutationListeners.add(callback);
    return () => {
      this.mutationListeners.delete(callback);
    };
  }

  public onPeers(callback: PeersListener): () => void {
    this.peersListeners.add(callback);
    // Call immediately with current peers
    callback(this.activePeers, this.activePeers.length);
    return () => {
      this.peersListeners.delete(callback);
    };
  }

  public onConnectionState(callback: ConnectionStateListener): () => void {
    this.stateListeners.add(callback);
    callback(this.connectionState);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  public getPeers(): LivePeerDevice[] {
    return this.activePeers;
  }

  public getConnectionState(): LiveConnectionState {
    return this.connectionState;
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (e) {}
      this.eventSource = null;
    }
    this.setConnectionState('disconnected');
  }
}

export const liveSync = new LiveSyncService();
