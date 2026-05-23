import { describe, it, expect } from "vitest";
import { extractRoles } from "./person-changes";

describe("extractRoles", () => {
  it("should return an empty array for null, undefined, or non-array inputs", () => {
    expect(extractRoles(null)).toEqual([]);
    expect(extractRoles(undefined)).toEqual([]);
    expect(extractRoles("not an array")).toEqual([]);
    expect(extractRoles({ type: "Director" })).toEqual([]);
    expect(extractRoles(123)).toEqual([]);
  });

  it("should return an empty array for an empty array input", () => {
    expect(extractRoles([])).toEqual([]);
  });

  it("should correctly extract valid role objects", () => {
    const validRoles = [
      {
        type: "Director",
        life: {
          start: "2020-01-01",
          end: "2023-01-01",
          title: "Managing Director",
          owner_percent: 50,
          owner_voting_percent: 50,
        },
      },
    ];
    expect(extractRoles(validRoles)).toEqual([
      {
        type: "Director",
        start: "2020-01-01",
        end: "2023-01-01",
        title: "Managing Director",
        owner_percent: 50,
        owner_voting_percent: 50,
      },
    ]);
  });

  it("should handle roles missing the life property", () => {
    const rolesWithoutLife = [
      {
        type: "Board Member",
      },
    ];
    expect(extractRoles(rolesWithoutLife)).toEqual([
      {
        type: "Board Member",
        start: null,
        end: null,
        title: null,
        owner_percent: null,
        owner_voting_percent: null,
      },
    ]);
  });

  it("should filter out roles with an empty type field", () => {
    const rolesWithEmptyType = [
      {
        type: "",
        life: {
          start: "2020-01-01",
        },
      },
      {
        type: "Director",
      },
      {
        life: {
          start: "2021-01-01",
        },
      },
    ];
    expect(extractRoles(rolesWithEmptyType)).toEqual([
      {
        type: "Director",
        start: null,
        end: null,
        title: null,
        owner_percent: null,
        owner_voting_percent: null,
      },
    ]);
  });

  it("should handle incorrect types for owner_percent and owner_voting_percent", () => {
    const rolesWithIncorrectPercentTypes = [
      {
        type: "Shareholder",
        life: {
          owner_percent: "50", // string instead of number
          owner_voting_percent: null,
        },
      },
      {
        type: "Partner",
        life: {
          owner_percent: null,
          owner_voting_percent: "100", // string instead of number
        },
      },
    ];
    expect(extractRoles(rolesWithIncorrectPercentTypes)).toEqual([
      {
        type: "Shareholder",
        start: null,
        end: null,
        title: null,
        owner_percent: null,
        owner_voting_percent: null,
      },
      {
        type: "Partner",
        start: null,
        end: null,
        title: null,
        owner_percent: null,
        owner_voting_percent: null,
      },
    ]);
  });
});
