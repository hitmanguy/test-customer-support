import { createRouter } from "@server/trpc/trpc.service";
import { User } from "../models/user.model";
import * as bcrypt from "bcrypt";
import { setCookie, getCookie } from "cookies-next"; // For session (if using cookies)
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const authRouter = createRouter((trpc) =>
  trpc.router({
    register: trpc.procedure
      .input(trpc.z.object({
        email: trpc.z.string().email(),
        password: trpc.z.string().min(6),
        name: trpc.z.string(),
        role: trpc.z.enum(['customer', 'agent', 'admin']),
      }))
      .mutation(async ({ input }) => {
        const existing = await User.findOne({ email: input.email });
        if (existing) throw new Error("User already exists");
        const hashed = await bcrypt.hash(input.password, 10);
        const user = await User.create({
          email: input.email,
          password: hashed,
          name: input.name,
          role: input.role,
        });
        return { success: true, userId: user._id.toString() };
      }),

    login: trpc.procedure
      .input(trpc.z.object({
        email: trpc.z.string().email(),
        password: trpc.z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await User.findOne({ email: input.email });
        if (!user) throw new Error("Invalid credentials");
        const valid = await bcrypt.compare(input.password, user.password);
        if (!valid) throw new Error("Invalid credentials");
        // Set session cookie here if needed
        // setCookie("session", user._id.toString(), { req: ctx.req, res: ctx.res });
        return { success: true, userId: user._id.toString(), name: user.name, role: user.role };
      }),

    googleOAuth: trpc.procedure
      .input(trpc.z.object({ googleToken: trpc.z.string() }))
      .mutation(async ({ input }) => {
        // 1. Verify Google token
        const ticket = await googleClient.verifyIdToken({
          idToken: input.googleToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) throw new Error("Invalid Google token");

        // 2. Find or create user in DB
        let user = await User.findOne({ email: payload.email });
        if (!user) {
          user = await User.create({
            email: payload.email,
            password: "", // No password for Google users
            name: payload.name || "Google User",
            role: "customer",
          });
        }
        return {
          success: true,
          userId: user._id.toString(),
          name: user.name,
          role: user.role,
        };
      }),
    getSession: trpc.procedure
      .query(async ({ ctx }) => {
        // If using cookies: getCookie("session", { req: ctx.req, res: ctx.res })
        // If using JWT: decode from header
        // For now, return null
        return { user: null };
      }),
  })
);