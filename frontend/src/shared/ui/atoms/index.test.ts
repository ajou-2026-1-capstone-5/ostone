import { describe, expect, it } from "vitest";
import {
  Avatar,
  type AvatarProps,
  Bar,
  type BarProps,
  Dot,
  type DotProps,
  Eyebrow,
  type EyebrowProps,
  Icon,
  type IconName,
  type IconProps,
  Mono,
  type MonoProps,
  Pill,
  type PillProps,
} from "./index";

describe("atoms/index", () => {
  it("exports Eyebrow component and EyebrowProps type", () => {
    expect(Eyebrow).toBeDefined();
    expect(typeof Eyebrow).toBe("function");
    const _props: EyebrowProps = {
      children: "label",
      tone: "mute",
      className: "test",
    };
    void _props;
  });

  it("exports Mono component and MonoProps type", () => {
    expect(Mono).toBeDefined();
    expect(typeof Mono).toBe("function");
    const _props: MonoProps = {
      children: "text",
      as: "code",
      className: "test",
      size: 12,
    };
    void _props;
  });

  it("exports Dot component and DotProps type", () => {
    expect(Dot).toBeDefined();
    expect(typeof Dot).toBe("function");
    const _props: DotProps = {
      tone: "signal",
      size: 8,
    };
    void _props;
  });

  it("exports Pill component and PillProps type", () => {
    expect(Pill).toBeDefined();
    expect(typeof Pill).toBe("function");
    const _props: PillProps = {
      tone: "warn",
      dark: true,
      active: false,
      size: "sm",
      children: "label",
    };
    void _props;
  });

  it("exports Bar component and BarProps type", () => {
    expect(Bar).toBeDefined();
    expect(typeof Bar).toBe("function");
    const _props: BarProps = {
      value: 0.5,
      tone: "signal",
      height: 10,
      className: "test",
    };
    void _props;
  });

  it("exports Avatar component and AvatarProps type", () => {
    expect(Avatar).toBeDefined();
    expect(typeof Avatar).toBe("function");
    const _props: AvatarProps = {
      name: "Test User",
      size: 24,
      tone: "signal",
    };
    void _props;
  });

  it("exports Icon component, IconName type, and IconProps type", () => {
    expect(Icon).toBeDefined();
    expect(typeof Icon).toBe("function");
    const _iconName: IconName = "check";
    const _props: IconProps = {
      name: _iconName,
      size: 24,
      className: "test",
    };
    void _props;
    void _iconName;
  });

  it("exports all 7 components", () => {
    expect(Eyebrow).toBeDefined();
    expect(Mono).toBeDefined();
    expect(Dot).toBeDefined();
    expect(Pill).toBeDefined();
    expect(Bar).toBeDefined();
    expect(Avatar).toBeDefined();
    expect(Icon).toBeDefined();
  });
});