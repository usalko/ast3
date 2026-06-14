import React, { useContext, useMemo } from "react";
import {
  Layout,
  Menu,
  Grid,
  Drawer,
  Button,
  theme,
  ConfigProvider,
  type MenuProps,
} from "antd";
import {
  DashboardOutlined,
  LogoutOutlined,
  UnorderedListOutlined,
  BarsOutlined,
  LeftOutlined,
  RightOutlined,
  UserOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  type ITreeMenu,
  useGetIdentity,
  useIsExistAuthentication,
  useLink,
  useRefineContext,
  useRouterContext,
  useRouterType,
  useMenu,
  useTranslate,
  useWarnAboutChange,
} from "@refinedev/core";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ThemedHeaderV2,
  ThemedLayoutContextProvider,
  ThemedTitleV2,
  useThemedLayoutContext,
} from "@refinedev/antd";

type SiderMenuProps = {
  Title?: React.FC<{ collapsed: boolean }>;
};

type AppLayoutProps = {
  children: React.ReactNode;
  initialSiderCollapsed?: boolean;
  onSiderCollapsed?: (collapsed: boolean) => void;
};

type MenuItem = Required<MenuProps>["items"][number];

function toMenuItem(item: ITreeMenu, Link: React.ComponentType<{ to: string; children: React.ReactNode; style?: React.CSSProperties }>): MenuItem {
  const { icon, label, route, key, children } = item;
  const itemKey = key ?? item.name ?? item.identifier ?? "";
  const itemIcon = icon ?? <UnorderedListOutlined />;
  const itemChildren = children ?? [];
  const itemLabel = route ? <Link to={route}>{label}</Link> : label;

  return {
    key: itemKey,
    icon: itemIcon,
    label: itemLabel,
    children: itemChildren.length > 0 ? itemChildren.map((child) => toMenuItem(child, Link)) : undefined,
  };
}

export function SiderTitle({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  return (
    <div
      style={{
        fontSize: collapsed ? 18 : 28,
        fontWeight: 700,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        letterSpacing: 4,
        cursor: "pointer",
      }}
      onClick={() => navigate("/")}
    >
      {collapsed ? "A" : "AST3"}
    </div>
  );
}

export function AppLayout({
  children,
  initialSiderCollapsed,
  onSiderCollapsed,
}: AppLayoutProps) {
  const breakpoint = Grid.useBreakpoint();
  const isSmall = typeof breakpoint.sm === "undefined" ? true : breakpoint.sm;

  return (
    <ThemedLayoutContextProvider
      initialSiderCollapsed={initialSiderCollapsed}
      onSiderCollapsed={onSiderCollapsed}
    >
      <Layout style={{ minHeight: "100vh" }} hasSider>
        <SiderMenu />
        <Layout>
          <ThemedHeaderV2 />
          <Layout.Content>
            <div
              style={{
                minHeight: 360,
                padding: isSmall ? 24 : 12,
              }}
            >
              {children}
            </div>
          </Layout.Content>
        </Layout>
      </Layout>
    </ThemedLayoutContextProvider>
  );
}

export function SiderMenu({ Title = SiderTitle }: SiderMenuProps) {
  const { token } = theme.useToken();
  const {
    siderCollapsed,
    setSiderCollapsed,
    mobileSiderOpen,
    setMobileSiderOpen,
  } = useThemedLayoutContext();
  const direction = useContext(ConfigProvider.ConfigContext)?.direction;
  const routerType = useRouterType();
  const NewLink = useLink();
  const { warnWhen, setWarnWhen } = useWarnAboutChange();
  const { Link: LegacyLink } = useRouterContext();
  const translate = useTranslate();
  const { menuItems, selectedKey, defaultOpenKeys } = useMenu();
  const breakpoint = Grid.useBreakpoint();
  const { hasDashboard } = useRefineContext();
  const isExistAuthentication = useIsExistAuthentication();
  const navigate = useNavigate();
  const { data: identity, isLoading: identityLoading } = useGetIdentity<{
    id?: string;
    fullName?: string;
    email?: string;
  }>();

  const Link = routerType === "legacy" ? LegacyLink : NewLink;
  const location = useLocation();
  const isMobile =
    typeof breakpoint.lg === "undefined" ? false : !breakpoint.lg;

  const handleLogout = () => {
    if (warnWhen) {
      const confirm = window.confirm(
        translate(
          "warnWhenUnsavedChanges",
          "Are you sure you want to leave? You have unsaved changes.",
        ),
      );

      if (confirm) {
        setWarnWhen(false);
      } else {
        return;
      }
    }

    localStorage.removeItem("ast3_access");
    localStorage.removeItem("ast3_refresh");
    navigate("/login");
  };

  const menuTreeItems = useMemo(
    () => menuItems.map((item) => toMenuItem(item, Link)),
    [menuItems, Link],
  );

  const defaultOpenMenuItems = useMemo(
    () => menuItems.map(({ key }) => key),
    [menuItems],
  );

  const items = useMemo<MenuItem[]>(() => {
    const dashboardItem = {
      key: "/",
      icon: <DashboardOutlined />,
      label: (
        <Link to="/">
          {translate("dashboard.title", "Dashboard")}
        </Link>
      ),
    };

    const teamItem = isExistAuthentication
      ? {
          key: "/team",
          icon: <TeamOutlined />,
          label: (
            <Link to="/team">
              Управление сотрудниками
            </Link>
          ),
        }
      : undefined;

    const dividerItem = isExistAuthentication
      ? { type: "divider" }
      : undefined;

    const logoutItem = isExistAuthentication
      ? {
          key: "logout",
          icon: <LogoutOutlined />,
          label: translate("buttons.logout", "Logout"),
          onClick: handleLogout,
        }
      : undefined;

    return [dashboardItem, ...menuTreeItems, dividerItem, teamItem, logoutItem].filter(
      Boolean,
    ) as MenuItem[];
  }, [
    hasDashboard,
    isExistAuthentication,
    menuTreeItems,
    translate,
    handleLogout,
  ]);

  const renderClosingIcons = () => {
    const iconProps = { style: { color: token.colorPrimary } };
    const OpenIcon = direction === "rtl" ? RightOutlined : LeftOutlined;
    const CollapsedIcon = direction === "rtl" ? LeftOutlined : RightOutlined;
    const IconComponent = siderCollapsed ? CollapsedIcon : OpenIcon;

    return <IconComponent {...iconProps} />;
  };

  const renderMenu = () => (
    <Menu
      selectedKeys={[location.pathname === "/" ? "/" : location.pathname]}
      defaultOpenKeys={[...defaultOpenKeys, ...defaultOpenMenuItems]}
      mode="inline"
      items={items}
      style={{
        paddingTop: "8px",
        border: "none",
        overflow: "auto",
        height: "calc(100% - 128px)",
      }}
      onClick={() => {
        setMobileSiderOpen(false);
      }}
    />
  );

  const renderUserInfo = () => {
    if (siderCollapsed) {
      return (
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderTop: `1px solid ${token.colorBgElevated}`,
          }}
          title={identity?.email}
        >
          <UserOutlined />
        </div>
      );
    }

    return (
      <div
        style={{
          height: 64,
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
          borderTop: `1px solid ${token.colorBgElevated}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UserOutlined />
          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {identityLoading ? "Загрузка..." : identity?.fullName || identity?.email || "Пользователь"}
          </div>
        </div>
        {identity?.email ? (
          <div style={{ fontSize: 12, color: token.colorTextSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {identity.email}
          </div>
        ) : null}
      </div>
    );
  };

  const siderStyles: React.CSSProperties = {
    backgroundColor: token.colorBgContainer,
    borderRight: `1px solid ${token.colorBgElevated}`,
  };

  if (isMobile) {
    return (
      <>
        <Drawer
          open={mobileSiderOpen}
          onClose={() => setMobileSiderOpen(false)}
          placement={direction === "rtl" ? "right" : "left"}
          closable={false}
          width={200}
          styles={{ body: { padding: 0 } }}
          maskClosable
        >
          <Layout>
            <Layout.Sider
              style={{
                height: "100vh",
                backgroundColor: token.colorBgContainer,
                borderRight: `1px solid ${token.colorBgElevated}`,
              }}
            >
              <div
                style={{
                  width: "200px",
                  padding: "0 16px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "64px",
                  backgroundColor: token.colorBgElevated,
                }}
              >
                <Title collapsed={false} />
              </div>
              {renderMenu()}
            </Layout.Sider>
          </Layout>
        </Drawer>
        <Button
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            zIndex: 999,
          }}
          size="large"
          onClick={() => setMobileSiderOpen(true)}
          icon={<BarsOutlined />}
        />
      </>
    );
  }

  return (
    <Layout.Sider
      style={siderStyles}
      collapsible
      collapsed={siderCollapsed}
      onCollapse={(collapsed, type) => {
        if (type === "clickTrigger") {
          setSiderCollapsed(collapsed);
        }
      }}
      collapsedWidth={80}
      breakpoint="lg"
      trigger={
        <Button
          type="text"
          style={{
            borderRadius: 0,
            height: "100%",
            width: "100%",
            backgroundColor: token.colorBgElevated,
          }}
        >
          {renderClosingIcons()}
        </Button>
      }
      >
      <div
        style={{
          width: siderCollapsed ? "80px" : "200px",
          padding: siderCollapsed ? "0" : "0 16px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "64px",
          backgroundColor: token.colorBgElevated,
          fontSize: "14px",
        }}
      >
        <Title collapsed={siderCollapsed} />
      </div>
      {renderMenu()}
      {renderUserInfo()}
    </Layout.Sider>

  );
}
