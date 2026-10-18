import { describe, expect, it } from "vitest";
import { parseAiBusinessSettingChange } from "./settings-change";

describe("AI business setting change requests", () => {
  it("parses explicit, specific profile changes into a confirmation proposal", () => {
    expect(parseAiBusinessSettingChange("Please change the business phone to +254 700 111222")).toEqual({
      field: "phone",
      value: "+254 700 111222",
      label: "business phone",
    });
    expect(parseAiBusinessSettingChange("set timezone as Africa/Nairobi")).toEqual({
      field: "timeZone",
      value: "Africa/Nairobi",
      label: "time zone",
    });
  });

  it("does not infer changes from vague requests or unrelated settings", () => {
    expect(parseAiBusinessSettingChange("Change the settings")).toBeNull();
    expect(parseAiBusinessSettingChange("Set the payment credential to abc")).toBeNull();
    expect(parseAiBusinessSettingChange("What is the business phone?")).toBeNull();
  });
});
