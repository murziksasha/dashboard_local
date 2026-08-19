import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

const DEFAULT_API =
  Constants.expoConfig?.extra?.apiUrl || "http://localhost:3000";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushAsync(apiUrl, token) {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  const push = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  const pushToken = push.data;
  await SecureStore.setItemAsync("dl_push", pushToken);
  await fetch(`${apiUrl}/api/push/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: pushToken,
      platform: Platform.OS,
      deviceName: Device.modelName || Device.deviceName || null,
    }),
  }).catch(() => null);
  return pushToken;
}

export default function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API);
  const [token, setToken] = useState(null);
  const [login, setLogin] = useState("admin");
  const [password, setPassword] = useState("");
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [issues, setIssues] = useState([]);
  const [issue, setIssue] = useState(null);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const pushRegistered = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync("dl_token");
        const savedUrl = await SecureStore.getItemAsync("dl_api");
        if (savedUrl) setApiUrl(savedUrl);
        if (saved) {
          setToken(saved);
          await loadProjects(saved, savedUrl || DEFAULT_API);
        }
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!token || pushRegistered.current) return;
    pushRegistered.current = true;
    registerForPushAsync(apiUrl, token).catch(() => null);
  }, [token, apiUrl]);

  async function loadProjects(tok, base = apiUrl) {
    const res = await fetch(`${base}/api/projects`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "projects_failed");
    setProjects(data.projects || []);
  }

  async function onLogin() {
    setError(null);
    setLoading(true);
    try {
      await SecureStore.setItemAsync("dl_api", apiUrl);
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "login_failed");
      await SecureStore.setItemAsync("dl_token", data.token);
      setToken(data.token);
      pushRegistered.current = false;
      await loadProjects(data.token, apiUrl);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function openProject(project) {
    setSelected(project);
    setIssue(null);
    setLoading(true);
    setError(null);
    try {
      const [projRes, issuesRes] = await Promise.all([
        fetch(`${apiUrl}/api/projects/${project.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/api/projects/${project.id}/issues`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const projData = await projRes.json();
      const issuesData = await issuesRes.json();
      if (!projRes.ok) throw new Error(projData.error || "project_failed");
      if (!issuesRes.ok) throw new Error(issuesData.error || "issues_failed");
      setStatuses(projData.statuses || []);
      setIssues(issuesData.issues || []);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function openIssue(item) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl}/api/projects/${selected.id}/issues/${item.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "issue_failed");
      setIssue(data.issue);
      setComments(data.comments || []);
      setAttachments(data.attachments || []);
      setCommentText("");
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function addComment() {
    if (!issue || !selected || !commentText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl}/api/projects/${selected.id}/issues/${issue.id}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body: commentText.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "comment_failed");
      await openIssue(issue);
    } catch (e) {
      setError(String(e.message || e));
      setLoading(false);
    }
  }

  async function uploadAttachment() {
    if (!issue || !selected) return;
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets?.length) return;
      const asset = picked.assets[0];
      if (asset.size && asset.size > 25 * 1024 * 1024) {
        throw new Error("file_too_large");
      }

      setUploading(true);
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name || "file",
        type: asset.mimeType || "application/octet-stream",
      });

      const res = await fetch(
        `${apiUrl}/api/projects/${selected.id}/issues/${issue.id}/attachments`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "upload_failed");
      await openIssue(issue);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setUploading(false);
    }
  }

  async function openAttachment(att) {
    setError(null);
    try {
      const safeName = String(att.filename || "file").replace(/[^\w.\-() ]/g, "_");
      const target = `${FileSystem.cacheDirectory}${att.id}_${safeName}`;
      const result = await FileSystem.downloadAsync(
        `${apiUrl}/api/attachments/${att.id}`,
        target,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("sharing_unavailable");
      }
      await Sharing.shareAsync(result.uri, {
        mimeType: att.mime_type || undefined,
        dialogTitle: att.filename,
      });
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function changeStatus(statusId) {
    if (!issue || !selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiUrl}/api/projects/${selected.id}/issues/${issue.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ statusId }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "status_failed");
      setIssue(data.issue);
      await openProject(selected);
      setIssue(data.issue);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function createIssue() {
    if (!selected || !newTitle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/projects/${selected.id}/issues`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: newTitle.trim(), type: "task" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "create_failed");
      setCreateOpen(false);
      setNewTitle("");
      await openProject(selected);
      setIssue(data.issue);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const push = await SecureStore.getItemAsync("dl_push");
    if (push && token) {
      await fetch(`${apiUrl}/api/push/register`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: push }),
      }).catch(() => null);
      await SecureStore.deleteItemAsync("dl_push");
    }
    await SecureStore.deleteItemAsync("dl_token");
    pushRegistered.current = false;
    setToken(null);
    setProjects([]);
    setSelected(null);
    setIssues([]);
    setIssue(null);
  }

  const title = useMemo(() => {
    if (issue) return issue.key;
    if (selected) return selected.name;
    return "Dashboard Local";
  }, [selected, issue]);

  if (loading && !token) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0284c7" />
      </View>
    );
  }

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <Text style={styles.h1}>Вхід</Text>
        <Text style={styles.hint}>API URL сервера в LAN</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={login}
          onChangeText={setLogin}
          placeholder="Логін"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Пароль"
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.btn} onPress={onLogin}>
          <Text style={styles.btnText}>Увійти</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.h1}>{title}</Text>
        <Pressable onPress={logout}>
          <Text style={styles.link}>Вийти</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading || uploading ? <ActivityIndicator color="#0284c7" /> : null}

      {!selected ? (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => openProject(item)}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.meta}>{item.key}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.hint}>Немає проєктів</Text>}
        />
      ) : issue ? (
        <ScrollView>
          <Pressable onPress={() => setIssue(null)}>
            <Text style={styles.link}>← Список задач</Text>
          </Pressable>
          <Text style={styles.cardTitle}>{issue.title}</Text>
          <Text style={styles.meta}>
            {issue.status_name} · {issue.type} ·{" "}
            {issue.assignee_names || issue.assignee_name || "—"}
          </Text>
          {issue.description ? (
            <Text style={styles.body}>{issue.description}</Text>
          ) : null}
          <Text style={[styles.hint, { marginTop: 16 }]}>Змінити статус</Text>
          <View style={styles.rowWrap}>
            {statuses.map((s) => (
              <Pressable
                key={s.id}
                style={[
                  styles.chip,
                  issue.status_id === s.id && styles.chipActive,
                ]}
                onPress={() => changeStatus(s.id)}
              >
                <Text
                  style={[
                    styles.chipText,
                    issue.status_id === s.id && styles.chipTextActive,
                  ]}
                >
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.row, { marginTop: 20 }]}>
            <Text style={styles.hint}>Вкладення ({attachments.length})</Text>
            <Pressable onPress={uploadAttachment} disabled={uploading}>
              <Text style={styles.link}>
                {uploading ? "Завантаження…" : "+ Файл"}
              </Text>
            </Pressable>
          </View>
          {attachments.length === 0 ? (
            <Text style={styles.meta}>Немає файлів</Text>
          ) : (
            attachments.map((a) => (
              <Pressable
                key={a.id}
                style={styles.card}
                onPress={() => openAttachment(a)}
              >
                <Text style={styles.key}>{a.filename}</Text>
                <Text style={styles.meta}>
                  {Math.round((a.size_bytes || 0) / 1024)} КБ · відкрити
                </Text>
              </Pressable>
            ))
          )}

          <Text style={[styles.hint, { marginTop: 12 }]}>
            Коментарі ({comments.length})
          </Text>
          {comments.map((c) => (
            <View key={c.id} style={styles.card}>
              <Text style={styles.meta}>
                {c.author_name} · {String(c.created_at || "").slice(0, 16)}
              </Text>
              <Text style={styles.body}>{c.body}</Text>
            </View>
          ))}
          <TextInput
            style={[styles.input, { minHeight: 70 }]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Новий коментар"
            multiline
          />
          <Pressable style={styles.btn} onPress={addComment}>
            <Text style={styles.btnText}>Додати коментар</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <>
          <View style={styles.row}>
            <Pressable onPress={() => setSelected(null)}>
              <Text style={styles.link}>← Проєкти</Text>
            </Pressable>
            <Pressable onPress={() => setCreateOpen(true)}>
              <Text style={styles.link}>+ Задача</Text>
            </Pressable>
          </View>
          <FlatList
            data={issues}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.card} onPress={() => openIssue(item)}>
                <Text style={styles.key}>{item.key}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.status_name} ·{" "}
                  {item.assignee_names || item.assignee_name || "—"}
                </Text>
              </Pressable>
            )}
          />
        </>
      )}

      <Modal visible={createOpen} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.h1}>Нова задача</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Заголовок"
            />
            <View style={styles.row}>
              <Pressable onPress={() => setCreateOpen(false)}>
                <Text style={styles.link}>Скасувати</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={createIssue}>
                <Text style={styles.btnText}>Створити</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8", padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  h1: { fontSize: 22, fontWeight: "700", color: "#18181b" },
  hint: { color: "#71717a", marginBottom: 8 },
  input: {
    backgroundColor: "#fff",
    borderColor: "#e4e4e7",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  btn: {
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderColor: "#e4e4e7",
    borderWidth: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#18181b" },
  key: { color: "#0284c7", fontWeight: "700", marginBottom: 2 },
  meta: { color: "#71717a", marginTop: 4, fontSize: 12 },
  body: { marginTop: 12, color: "#3f3f46", lineHeight: 20 },
  link: { color: "#0284c7", fontWeight: "600", marginBottom: 8 },
  error: { color: "#e11d48", marginBottom: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d4d4d8",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0284c7", borderColor: "#0284c7" },
  chipText: { color: "#3f3f46", fontSize: 12 },
  chipTextActive: { color: "#fff" },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
});
