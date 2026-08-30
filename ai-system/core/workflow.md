GLOBAL WORKFLOW (STRICT)

You MUST follow this execution flow step-by-step.
You are NOT allowed to skip, reorder, or merge steps.

--------------------------------------------------

STEP 1: Requirement Analysis
- Understand user intent
- Identify missing requirements
- Clarify assumptions if needed

--------------------------------------------------

STEP 2: System Design
- Define overall architecture
- Identify modules and services
- Ensure alignment with architecture-guidelines.md

--------------------------------------------------

STEP 3: Database Design
- Define tables and relationships
- Add indexes for performance
- Validate against backend-rules.md

--------------------------------------------------

STEP 4: API Design
- Define endpoints
- Define request/response structure
- Ensure consistency and scalability

--------------------------------------------------

STEP 5: Frontend Structure
- Define MainLayout (Navbar + Left + Center + Right)
- Define reusable components
- Ensure consistency with frontend-rules.md

--------------------------------------------------

STEP 6: Implementation

6.1 Backend Implementation
- Build core APIs (auth, post, feed, user)

6.2 Frontend Implementation
- Integrate APIs
- Apply component structure

6.3 UI Conversion (MANDATORY)
- Delegate to UI Conversion Agent
- Convert design/HTML into component-based UI
- MUST follow MainLayout system

6.4 UI Polish (MANDATORY)
- Delegate to UI Pixel Polish Agent
- Fix spacing, alignment, font, layout issues
- MUST achieve near pixel-perfect accuracy

--------------------------------------------------

STEP 7: Performance Optimization
- Apply caching (Redis)
- Optimize database queries
- Move heavy tasks to background jobs

--------------------------------------------------

STEP 8: Validation (MANDATORY)

8.1 Self Review
- Execute ALL checks from self-review.md

8.2 Validation Loop (CRITICAL)
IF any issue is found:
  → Determine issue type:
    - UI issue → return to UI Pixel Polish Agent
    - Structure issue → return to UI Conversion Agent
    - Logic issue → return to Implementation step

  → Fix issue
  → Re-run validation

REPEAT until ALL checks pass

--------------------------------------------------

STEP 9: Definition of Done Check

You MUST validate against constraints.md:

- Layout is consistent across all pages
- Navbar is identical everywhere
- MainLayout is reused
- No duplicate components exist
- UI is visually consistent
- Performance optimizations applied

IF ANY condition fails:
→ RETURN to STEP 8

--------------------------------------------------

STEP 10: Final Output

- Deliver complete system
- Follow execution-template.md format strictly

--------------------------------------------------

AGENT EXECUTION CHAIN (ENFORCED)

1. System Architect
   - Analyze + Plan
   - Control entire flow

2. UI Conversion Agent
   - Build component structure

3. UI Pixel Polish Agent
   - Fix visual accuracy

4. Self Review
   - Validate and trigger loop if needed

--------------------------------------------------

CRITICAL RULES:

- You MUST NOT skip any step
- You MUST NOT finalize before validation passes
- You MUST enforce MainLayout consistency
- You MUST eliminate duplicate components
- You MUST repeat until system is complete