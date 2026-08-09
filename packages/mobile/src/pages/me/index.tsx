import { useCallback, useEffect, useState } from "react";
import { Button, Input, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { TopBar } from "@/components/TopBar";
import { useAppStore } from "@/store";
import {
  createChild,
  fetchChildren,
  setActiveChild,
  updateChild,
  type ChildSummary,
} from "@/services/api";
import type { Grade } from "@lightning-tiger/shared";
import "./index.scss";

const DEFAULT_GRADE: Grade = "小学";

export default function MePage() {
  const { state, dispatch } = useAppStore();
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [draftName, setDraftName] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    if (!state.session) return;
    setLoading(true);
    try {
      const workspace = await fetchChildren();
      setChildren(workspace.children);
      const activeChild = workspace.children.find((child) => child.id === workspace.activeChildId) ?? null;
      dispatch({ type: "SET_ACTIVE_CHILD", activeChild });
    } catch {
      Taro.showToast({ title: "Unable to load children", icon: "none" });
    } finally {
      setLoading(false);
    }
  }, [dispatch, state.session]);

  useEffect(() => {
    loadChildren();
  }, [loadChildren]);

  const saveChild = async () => {
    const displayName = draftName.trim();
    if (!displayName) {
      Taro.showToast({ title: "Enter a child name", icon: "none" });
      return;
    }

    try {
      const child = editing && state.activeChild
        ? await updateChild(state.activeChild.id, displayName)
        : await createChild(displayName, state.activeChild?.grade ?? DEFAULT_GRADE);
      dispatch({ type: "SET_ACTIVE_CHILD", activeChild: child });
      setDraftName("");
      setEditing(false);
      await loadChildren();
    } catch {
      Taro.showToast({ title: "Unable to save child", icon: "none" });
    }
  };

  const chooseActiveChild = async () => {
    if (!children.length) return;
    const result = await Taro.showActionSheet({ itemList: children.map((child) => child.displayName) });
    const child = children[result.tapIndex];
    if (!child) return;

    try {
      const activeChild = await setActiveChild(child.id);
      dispatch({ type: "SET_ACTIVE_CHILD", activeChild });
    } catch {
      Taro.showToast({ title: "Unable to switch child", icon: "none" });
    }
  };

  const beginRename = () => {
    if (!state.activeChild) return;
    setDraftName(state.activeChild.displayName);
    setEditing(true);
  };

  const title = state.parent?.displayName ? `${state.parent.displayName}'s family` : "My family";

  return (
    <View className="me-screen">
      <TopBar />
      <View className="profile-hero">
        <View className="profile-info">
          <Text className="p">{title}</Text>
          <Text className="h1">Child workspace</Text>
          <Text className="small">{state.activeChild?.displayName ?? "Choose or add a child to begin"}</Text>
        </View>
      </View>

      <View className="dashboard card-dashboard">
        {!state.session ? (
          <View className="function-card">
            <View className="function-trigger">
              <Text className="span">
                <Text className="b">Sign in to manage children</Text>
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View className="function-card">
              <View className="function-trigger">
                <Text className="span">
                  <Text className="small">Active child</Text>
                  <Text className="b">{state.activeChild?.displayName ?? "No active child"}</Text>
                  <Text className="em">{state.activeChild?.grade ?? "Add a child to create a workspace"}</Text>
                </Text>
                <Button className="button" onClick={chooseActiveChild} disabled={!children.length || loading}>
                  Switch
                </Button>
              </View>
            </View>

            <View className="function-card">
              <View className="function-trigger">
                <View className="span">
                  <Text className="small">{editing ? "Rename active child" : "Add child"}</Text>
                  <Input
                    value={draftName}
                    placeholder="Child name"
                    onInput={(event) => setDraftName(event.detail.value)}
                  />
                </View>
                <Button className="button" onClick={saveChild} disabled={loading}>
                  {editing ? "Save" : "Add"}
                </Button>
              </View>
              {state.activeChild && !editing && (
                <View className="teacher-expand-actions">
                  <Button className="button" onClick={beginRename}>Rename active child</Button>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
