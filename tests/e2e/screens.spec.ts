import { expect, test, type Page } from "@playwright/test";

// Loads every route at 390x844 and 1280x800 and saves screenshots named like the
// design PNGs in Designing/png, so the two folders can be compared side by side.

const shot = async (page: Page, name: string) => {
  const mobile = test.info().project.name === "mobile";
  const file = mobile ? name : `Desktop${name === "Main" ? "Home" : name}`;
  await page.screenshot({ path: `tests/e2e/screenshots/${file}.png`, fullPage: true });
};

/** Every visible link, button and radio label is at least 44px in both directions. */
const expectTouchTargets = async (page: Page) => {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("a, button, label:has(input)")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 43.5 || r.width < 43.5)
      .map(({ el, r }) => `${el.tagName} "${el.textContent?.trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
};

const next = async (page: Page, times = 1) => {
  for (let i = 0; i < times; i++) {
    const before = await page.locator("main:visible").innerText();
    await page.locator("footer:visible button").click();
    await expect(page.locator("main:visible")).not.toHaveText(before, { useInnerText: true });
  }
};

test("dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sveiki, Ebrahim!");
  const mobile = test.info().project.name === "mobile";
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(1);
  await expect(page.getByText("Last score")).toBeVisible({ visible: mobile });
  await expect(page.getByText("See full results")).toBeVisible({ visible: !mobile });
  await expectTouchTargets(page);
  await shot(page, "Main");
});

test("results show the practice banner and say the outcome in words", async ({ page }) => {
  await page.goto("/exam/mock-exam-1/results");
  await expect(page.getByRole("note")).toHaveText("AI practice estimate. Not an official VIAA result or certificate.");
  await expect(page.getByText("Not passed yet")).toBeVisible();
  await expect(page.getByText("7/15 · Below 9")).toBeVisible();
  await expect(page.getByText("12/15 · Pass")).toBeVisible();
  await expectTouchTargets(page);
  await shot(page, "Results");
});

test("writing feedback, with Arabic explanations right-to-left", async ({ page }) => {
  await page.goto("/exam/mock-exam-1/results/writing/3");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Writing, task 3");
  await expect(page.getByText("Es biju koncertā.")).toBeVisible();
  await expectTouchTargets(page);
  await shot(page, "Feedback");

  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("main [dir=rtl][lang=ar]")).toBeVisible();
  await expect(page.getByText("التصحيحات")).toBeVisible();
  // Latvian stays left-to-right inside the right-to-left view
  await expect(page.getByText("Es biju koncertā.")).toHaveAttribute("dir", "ltr");
  await shot(page, "FeedbackArabic");
});

test("unknown attempts and tasks show the not-found page", async ({ page }) => {
  // Pages stream, so the HTTP status is already sent; the not-found page is what the learner sees.
  for (const url of ["/exam/does-not-exist", "/exam/does-not-exist/results", "/exam/mock-exam-1/results/writing/9"]) {
    await page.goto(url);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  }
});

test("full exam run through all four parts", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Start exam" }).click();
  await page.waitForURL(/\/exam\/[0-9a-f-]{36}$/);
  const examUrl = page.url();

  // Strict exam mode: Latvian content, and no answer key anywhere in the page.
  await expect(page.locator("main:visible")).toHaveAttribute("lang", "lv");
  expect(await page.content()).not.toContain("answerKey");
  expect(await page.content()).not.toContain("Koncerts sāksies pulksten 19.00");

  // Listening, task 1, announcement 2 (the designed screen)
  await next(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cikos sāksies koncerts?");
  await page.getByText("Pulksten 19.00.").click();
  await expect(page.getByRole("radio", { name: "Pulksten 19.00." })).toBeChecked();
  await page.getByRole("button", { name: "Atskaņot ierakstu" }).click();
  await expect(page.getByRole("button", { name: "Apturēt ierakstu" })).toBeVisible();
  await page.waitForTimeout(2200);
  await expect(page.getByText("0:02 / 0:21")).toBeVisible();
  await expectTouchTargets(page);
  await shot(page, "Listening");

  // A refresh keeps the server deadline and the saved answer, and resumes at the
  // first unanswered screen (announcement 1 was skipped).
  await page.reload();
  await expect(page.getByText("1. paziņojums no 6")).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText(/^2[34]:\d\d$/);
  await next(page);
  await expect(page.getByRole("radio", { name: "Pulksten 19.00." })).toBeChecked();

  // Reading, task 2, situation 1
  await next(page, 11 + 4);
  await expect(page.getByText("1. situācija no 6")).toBeVisible();
  await page.getByRole("radiogroup", { name: "Sludinājums" }).getByText("C", { exact: true }).click();
  await expectTouchTargets(page);
  await shot(page, "Reading");

  // Writing, task 3
  await next(page, 7 + 2);
  await expect(page.getByText("6 punkti")).toBeVisible();
  await page.getByLabel("Jūsu e-pasts").fill("Sveiks, Jāni!\nSestdien es biju koncertā Rīgā. Koncerts bija ļoti labs. Man patika mūzika, bet ");
  await expect(page.getByText("15 no 35 vārdiem")).toBeVisible();
  await page.getByRole("button", { name: "ļ" }).click();
  await expect(page.getByLabel("Jūsu e-pasts")).toHaveValue(/bet ļ$/);
  await page.getByLabel("Jūsu e-pasts").press("Backspace");
  await expect(page.getByText("15 no 35 vārdiem")).toBeVisible();
  await page.getByLabel("Jūsu e-pasts").blur();
  await expectTouchTargets(page);
  await shot(page, "Writing");

  // Speaking, task 2, picture 1, while recording (fake microphone)
  await next(page, 1 + 10);
  await expect(page.getByText("1. attēls no 2")).toBeVisible();
  await page.getByRole("button", { name: "Sākt ierakstu" }).click();
  await expect(page.getByRole("status")).toContainText("Ieraksts · 0:02", { timeout: 10_000 });
  await expectTouchTargets(page);
  await shot(page, "Speaking");
  await page.getByRole("button", { name: "Beigt ierakstu" }).click();
  await expect(page.getByRole("status")).toContainText("Ieraksts saglabāts");

  // Finish: results appear only now, with the banner
  await next(page, 4);
  await page.locator("footer:visible button").click();
  await page.waitForURL(/\/results$/);
  await expect(page.getByRole("note")).toHaveText("AI practice estimate. Not an official VIAA result or certificate.");
  await expect(page.getByText("Not passed yet")).toBeVisible();
  await expect(page.getByText("1/15 · Below 9").first()).toBeVisible();

  // The finished attempt cannot be reopened
  await page.goto(examUrl);
  await page.waitForURL(/\/results$/);
});
