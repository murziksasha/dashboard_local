import { Pressable, SafeAreaView, StyleSheet, Text, TextInput } from "react-native";
import { StatusBar } from "expo-status-bar";

export function LoginScreen(props: {
  apiUrl: string;
  login: string;
  password: string;
  error: string | null;
  onApiUrl: (v: string) => void;
  onLogin: (v: string) => void;
  onPassword: (v: string) => void;
  onSubmit: () => void;
  onBiometric?: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.h1}>Вхід</Text>
      <Text style={styles.hint}>API URL сервера в LAN</Text>
      <TextInput style={styles.input} value={props.apiUrl} onChangeText={props.onApiUrl} autoCapitalize="none" />
      <TextInput
        style={styles.input}
        value={props.login}
        onChangeText={props.onLogin}
        placeholder="Логін"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={props.password}
        onChangeText={props.onPassword}
        placeholder="Пароль"
        secureTextEntry
      />
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
      <Pressable style={styles.btn} onPress={props.onSubmit}>
        <Text style={styles.btnText}>Увійти</Text>
      </Pressable>
      {props.onBiometric ? (
        <Pressable onPress={props.onBiometric}>
          <Text style={styles.link}>Увійти з біометрією</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8", padding: 16 },
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
  error: { color: "#e11d48", marginBottom: 8 },
  link: { color: "#0284c7", fontWeight: "600", marginTop: 12, textAlign: "center" },
});
