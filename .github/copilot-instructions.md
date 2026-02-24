Requirements:
    The instruction should not be implemented immediately, they should be followed when something have to done.
    Technologies
        • Frontend: HTML, CSS, JavaScript and Bootstrap. It should be simple with JavaScript and without TypeScript, React or Vue.
        • Backend: Supabase as a backend for database, authentication and storage.
        • Build tools: Node.js, npm, Vite
    Architecture
        • The app should be with modular components and mobile friendly responsive design.
        • All pages should be separated: multi-page navigation. For example the url should be site_name/user/1 or site_name/user/1 or site_name/product/1 or site_name/admin/ or site_name/home/
            - Each page should be in speared dir in the app and it that dir it should have its javascritp html and css.
            - Each file with code should be small and there should not be duplicate code functions.
        • Routing and navigation between pages
        • Split the site layout into components: header, page content, footer
        • Page should be render dynamically

    Language:
        All site text should be in Bulgarian
        All code should be in english.
    Supabase:
        Authentication and Authorization: Supabase Auth with JWT tokens.
            • Use Row-Level Security (RLS) policies to implement access control.
        Databases changes:
            - Migration files should not be edited!
            - For each ne change we should have tem file for the migration in supabase/migrations/ and applied and deleted on approval
            - After each migration: Get the migration history table from the DB "supabase_migrations.schema_migrations" and add each new migration file to supabase/migrations as read-only file permissions.
        Database schema:
            There should be one table users:
                - with main column user_id (primary key auto increment)
                - there should be column for the name, second name, lastname, supa_user_uuid, created_on, deleted_on and boss relation to the id in supabase auth.users chek this doc https://supabase.com/docs/guides/auth/managing-user-data
                - I donto like to use supabaseuser ids I want to use in the apps the id from this table users, so auth.users uuid should be in supa_user_uuid, relation, but if supabase uuid is deleted in my table it should stay.
                - The table users column boss should be true or false.
            There should a view:
                - If I need info from auth.users I should get all info fo the user by user_id from table users
            There should be one table addresses:
                - And the main column address_id which will be incremented for each new row bigint
                - It should have user_id wich should be relation to user id in user table and row delete on user delete
                - Column jsonb for the address
                - column for the order extra: jsonb
            The should be table products:
                - Main column product_id (primary key auto increment)
                - column for Product images location (supabase storage location)
                - column for the product description: jsonb (name, brief info, info, and so on)
                - column for the product extra: jsonb
                - column for the product group relation to table product_group
                - column for the product price
                - column for the product discount or null
                - column availability: true/false
                - column created_on
            The should be table orders:
                - Main column order_id (primary key auto increment)
                - It should have user_id wich should be relation to user id in user table.
                - product_id (the should dbe no relation to table products since the product may be changed in future )
                - price
                - discount
                - short product description jsonb (name, brief info)
                - order status jsonb
                - order done: true/false
                - order date
                - column for the order extra: jsonb
                - order_arhived: true/false
                - order_user_delete: true/false
            Table discount:
                - Main column discount_id (primary key auto increment)
                - discount start date
                - discount end date
            Table product_group
                - Main column group_id (primary key auto increment)
                - name
                - group_discount relation to discount_id


    UI: User Interface and Design rules
        - Buttons - rounded
        - Colors - green gama
        - Fonts - little gothic
        - Layout
        - Forms
        - Navigation bars
        - Cards
        - Icons
        - Spacing
        - Animations
        - visual cues
        - toast notifications
        - Modern and user-friendly UI design
