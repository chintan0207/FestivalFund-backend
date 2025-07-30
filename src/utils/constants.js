export const DB_NAME = "Festivalfund";

export const GlobalRoleEnum = {
  ADMIN: "admin",
  VIEWER: "viewer",
};

export const AvailableGlobalRoles = Object.values(GlobalRoleEnum);

export const ContributionStatusEnum = {
  DEPOSITED: "deposited",
  PENDING: "pending",
  CANCELLED: "cancelled",
};

export const AvailableContributionStatuses = Object.values(ContributionStatusEnum);

export const ContributionTypeEnum = {
  CASH: "cash",
  ITEM: "item",
};

export const AvailableContributionTypes = Object.values(ContributionTypeEnum);

export const ExpenseCategoryEnum = {
  MAHAPRASAD: "Mahaprasad",
  DECORATION: "Decoration",
  SOUND: "Sound",
  OTHER: "Other",
};

export const AvailableExpenseCategories = Object.values(ExpenseCategoryEnum);

export const ContributorCategoryEnum = {
  PARENT: "Parents",
  YOUNG_BOY: "Boys",
  OTHER: "Other",
};

export const AvailableContributorCategories = Object.values(ContributorCategoryEnum);
